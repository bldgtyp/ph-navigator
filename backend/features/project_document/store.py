"""Saved/draft document loading and table read helpers."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from time import perf_counter
from typing import Any, NoReturn
from uuid import UUID

import structlog
from psycopg import Connection
from pydantic import BaseModel
from starlette import status

from database import connection, transaction
from features.project_document import repository
from features.project_document.document import ProjectDocumentV1
from features.project_document.migrations import UpgradeResult
from features.project_document.models import (
    ProjectDocumentReadSafeEnvelope,
    ProjectDocumentSource,
    ProjectDocumentView,
    ProjectDraftSummary,
)
from features.project_document.tables import get_table_contract, iter_table_contracts
from features.project_document.validation import (
    JsonValue,
    document_etag,
    next_draft_etag_from_etag,
    raw_json_value,
    serialize_document,
    upgrade_document_with_errors,
    validate_document,
    validate_document_with_errors,
)
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error

log = structlog.get_logger(__name__)


@dataclass(frozen=True)
class CurrentDocumentParts:
    version_body: ProjectDocumentV1
    version_etag: str
    version_locked: bool
    draft_body: ProjectDocumentV1 | None
    draft_etag: str | None
    last_patched_at: datetime | None


def get_saved_document(version_id: UUID, access: ProjectAccess) -> ProjectDocumentV1:
    start = perf_counter()
    with connection() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
    db_ms = _duration_ms(start)
    body = validate_document(version["body"])
    _log_loaded(access.project_id, version_id, "version", version["body"], db_ms)
    return body


def load_document_body(
    version_id: UUID,
    access: ProjectAccess,
    source: ProjectDocumentSource,
) -> ProjectDocumentV1:
    """Dispatch on ``source`` and return the corresponding document body.

    Aperture-derived REST routes and the MCP read path all need the same
    "draft → current view's body, version → saved" branch. Centralising it
    here keeps the dispatch consistent and removes the repeated literal
    `if source == "draft": ...` block from every caller.
    """

    if source == "draft":
        return get_current_document_view(version_id, access).body
    return get_saved_document(version_id, access)


def get_saved_document_or_read_safe(
    version_id: UUID, access: ProjectAccess, request_id: str
) -> ProjectDocumentV1 | ProjectDocumentReadSafeEnvelope:
    start = perf_counter()
    with connection() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
    db_ms = _duration_ms(start)
    document, errors = validate_document_with_errors(version["body"])
    if document is not None:
        _log_loaded(access.project_id, version_id, "version", version["body"], db_ms)
        return document
    return read_safe_envelope(
        access.project_id,
        version_id,
        "version",
        raw_json_value(version["body"]),
        request_id,
        errors if access.mode == "edit" else [],
        row_schema_version=version["schema_version"],
    )


def get_raw_saved_document(version_id: UUID, access: ProjectAccess) -> JsonValue:
    start = perf_counter()
    with connection() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
    db_ms = _duration_ms(start)
    _log_loaded(access.project_id, version_id, "version", version["body"], db_ms)
    return raw_json_value(version["body"])


def get_current_document_view(version_id: UUID, access: ProjectAccess) -> ProjectDocumentView:
    parts = load_current_document_parts(version_id, access)
    return current_document_view(version_id, access.project_id, parts)


def get_draft_summary(version_id: UUID, access: ProjectAccess) -> ProjectDraftSummary:
    parts = load_current_document_parts(version_id, access)
    return draft_summary(version_id, access.project_id, parts)


def get_draft_summary_or_read_safe(
    version_id: UUID, access: ProjectAccess, request_id: str
) -> ProjectDraftSummary | ProjectDocumentReadSafeEnvelope:
    user = require_editor_user(access)
    with transaction() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
        version_result, version_errors = upgrade_document_with_errors(version["body"])
        if version_result is None:
            return read_safe_envelope(
                access.project_id,
                version_id,
                "version",
                raw_json_value(version["body"]),
                request_id,
                version_errors,
                row_schema_version=version["schema_version"],
            )
        draft = repository.get_draft_for_update(conn, version_id, user.id)
        draft_body: ProjectDocumentV1 | None = None
        draft_etag: str | None = None
        last_patched_at: datetime | None = None
        if draft is not None:
            draft_result, draft_errors = upgrade_document_with_errors(draft["body"])
            if draft_result is None:
                return read_safe_envelope(
                    access.project_id,
                    version_id,
                    "draft",
                    raw_json_value(draft["body"]),
                    request_id,
                    draft_errors,
                    row_schema_version=draft["schema_version"],
                )
            draft_body, draft_etag, last_patched_at = rewrite_draft_if_upgraded(conn, draft, draft_result)
        version_body = version_result.document
        return draft_summary(
            version_id,
            access.project_id,
            CurrentDocumentParts(
                version_body=version_body,
                version_etag=document_etag(version_body),
                version_locked=bool(version["locked"]),
                draft_body=draft_body,
                draft_etag=draft_etag,
                last_patched_at=last_patched_at,
            ),
        )


def get_saved_and_current_document_view(
    version_id: UUID, access: ProjectAccess
) -> tuple[ProjectDocumentV1, ProjectDocumentView]:
    parts = load_current_document_parts(version_id, access)
    return parts.version_body, current_document_view(version_id, access.project_id, parts)


def get_saved_table_slice(version_id: UUID, table_name: str, access: ProjectAccess) -> BaseModel:
    contract = get_table_contract(table_name)
    version_body = get_saved_document(version_id, access)
    version_etag = document_etag(version_body)
    return contract.build_response(access.project_id, version_id, "version", version_etag, None, version_body)


def get_draft_table_slice(version_id: UUID, table_name: str, access: ProjectAccess) -> BaseModel:
    contract = get_table_contract(table_name)
    document = get_current_document_view(version_id, access)
    return contract.build_response(
        access.project_id,
        version_id,
        document.source,
        document.version_etag,
        document.draft_etag,
        document.body,
    )


def dirty_tables(version_body: ProjectDocumentV1, draft_body: ProjectDocumentV1) -> list[str]:
    return [
        contract.name
        for contract in iter_table_contracts()
        if contract.extract_diff_value(version_body) != contract.extract_diff_value(draft_body)
    ]


def draft_summary(version_id: UUID, project_id: UUID, parts: CurrentDocumentParts) -> ProjectDraftSummary:
    return ProjectDraftSummary(
        project_id=project_id,
        version_id=version_id,
        source="draft" if parts.draft_body is not None else "version",
        version_etag=parts.version_etag,
        draft_etag=parts.draft_etag,
        dirty_tables=dirty_tables(parts.version_body, parts.draft_body) if parts.draft_body is not None else [],
        last_patched_at=parts.last_patched_at,
        is_locked=parts.version_locked,
        can_edit=not parts.version_locked,
    )


def load_current_document_parts(version_id: UUID, access: ProjectAccess) -> CurrentDocumentParts:
    user = require_editor_user(access)
    start = perf_counter()
    with transaction() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
        draft = repository.get_draft_for_update(conn, version_id, user.id)
        version_body = validate_document(version["body"])
        draft_body: ProjectDocumentV1 | None = None
        draft_etag: str | None = None
        last_patched_at: datetime | None = None
        if draft is not None:
            draft_result, draft_errors = upgrade_document_with_errors(draft["body"])
            if draft_result is None:
                raise api_error(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "invalid_project_document",
                    "Project document failed validation.",
                    {"errors": draft_errors},
                )
            draft_body, draft_etag, last_patched_at = rewrite_draft_if_upgraded(conn, draft, draft_result)
    db_ms = _duration_ms(start)
    _log_loaded(
        access.project_id,
        version_id,
        "draft" if draft is not None else "version",
        draft["body"] if draft is not None else version["body"],
        db_ms,
    )
    return CurrentDocumentParts(
        version_body=version_body,
        version_etag=document_etag(version_body),
        version_locked=bool(version["locked"]),
        draft_body=draft_body,
        draft_etag=draft_etag,
        last_patched_at=last_patched_at,
    )


def rewrite_draft_if_upgraded(
    conn: Connection[Any],
    draft: dict[str, object],
    result: UpgradeResult,
) -> tuple[ProjectDocumentV1, str, datetime | None]:
    """Persist current-shape draft cache rows while saved versions stay immutable."""

    draft_etag = str(draft["draft_etag"])
    last_patched_at = draft["last_patched_at"] if isinstance(draft["last_patched_at"], datetime) else None
    if not result.requires_persisted_rewrite:
        return result.document, draft_etag, last_patched_at

    serialized = serialize_document(result.document)
    rewritten = repository.rewrite_draft_body(
        conn,
        UUID(str(draft["version_id"])),
        UUID(str(draft["user_id"])),
        result.document,
        next_draft_etag_from_etag(serialized.etag),
        serialized_body=serialized,
    )
    rewritten_at = rewritten["last_patched_at"]
    return (
        result.document,
        str(rewritten["draft_etag"]),
        rewritten_at if isinstance(rewritten_at, datetime) else None,
    )


def current_document_view(
    version_id: UUID,
    project_id: UUID,
    parts: CurrentDocumentParts,
) -> ProjectDocumentView:
    return ProjectDocumentView(
        project_id=project_id,
        version_id=version_id,
        source="draft" if parts.draft_body is not None else "version",
        version_etag=parts.version_etag,
        draft_etag=parts.draft_etag,
        body=parts.draft_body if parts.draft_body is not None else parts.version_body,
    )


def raise_project_version_not_found() -> NoReturn:
    raise api_error(
        status.HTTP_404_NOT_FOUND,
        "project_version_not_found",
        "Project version not found.",
    )


def read_safe_envelope(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    raw_body: JsonValue,
    request_id: str,
    validation_errors: list[str],
    *,
    row_schema_version: object,
) -> ProjectDocumentReadSafeEnvelope:
    schema_version = schema_version_from_raw(raw_body, row_schema_version)
    log.warning(
        "project_document.read_safe_mode",
        error_code="schema_validation_failed_after_migration",
        project_id=str(project_id),
        version_id=str(version_id),
        schema_version=schema_version,
        request_id=request_id,
    )
    return ProjectDocumentReadSafeEnvelope(
        project_id=project_id,
        version_id=version_id,
        source=source,
        schema_version=schema_version,
        error_code="schema_validation_failed_after_migration",
        message=(
            "This version uses an older project format that PHN could not fully migrate. "
            "Editing is disabled, but the raw project JSON is still available."
        ),
        request_id=request_id,
        validation_errors=validation_errors,
        body=raw_body,
    )


def schema_version_from_raw(raw_body: JsonValue, row_schema_version: object) -> int | None:
    if isinstance(raw_body, dict):
        raw_schema_version = raw_body.get("schema_version")
        if isinstance(raw_schema_version, int) and not isinstance(raw_schema_version, bool):
            return raw_schema_version
    if isinstance(row_schema_version, int) and not isinstance(row_schema_version, bool):
        return row_schema_version
    return None


def _log_loaded(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    raw_body: object,
    db_ms: float,
) -> None:
    log.info(
        "project_document.loaded",
        project_id=str(project_id),
        version_id=str(version_id),
        source=source,
        bytes=_json_size_bytes(raw_body),
        db_ms=db_ms,
    )


def _json_size_bytes(raw_body: object) -> int:
    return len(json.dumps(raw_body, separators=(",", ":"), default=str).encode("utf-8"))


def _duration_ms(start: float) -> float:
    return round((perf_counter() - start) * 1000, 2)
