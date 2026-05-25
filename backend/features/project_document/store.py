"""Saved/draft document loading and table read helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import NoReturn
from uuid import UUID

import structlog
from pydantic import BaseModel
from starlette import status

from database import connection
from features.project_document import repository
from features.project_document.document import ProjectDocumentV1
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
    raw_json_value,
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
    with connection() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
        return validate_document(version["body"])


def get_saved_document_or_read_safe(
    version_id: UUID, access: ProjectAccess, request_id: str
) -> ProjectDocumentV1 | ProjectDocumentReadSafeEnvelope:
    with connection() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
        document, errors = validate_document_with_errors(version["body"])
        if document is not None:
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
    with connection() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
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
    with connection() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
        version_body, version_errors = validate_document_with_errors(version["body"])
        if version_body is None:
            return read_safe_envelope(
                access.project_id,
                version_id,
                "version",
                raw_json_value(version["body"]),
                request_id,
                version_errors,
                row_schema_version=version["schema_version"],
            )
        draft = repository.get_draft(conn, version_id, user.id)
        draft_body: ProjectDocumentV1 | None = None
        if draft is not None:
            draft_body, draft_errors = validate_document_with_errors(draft["body"])
            if draft_body is None:
                return read_safe_envelope(
                    access.project_id,
                    version_id,
                    "draft",
                    raw_json_value(draft["body"]),
                    request_id,
                    draft_errors,
                    row_schema_version=draft["schema_version"],
                )
        return draft_summary(
            version_id,
            access.project_id,
            CurrentDocumentParts(
                version_body=version_body,
                version_etag=document_etag(version_body),
                version_locked=bool(version["locked"]),
                draft_body=draft_body,
                draft_etag=draft["draft_etag"] if draft is not None else None,
                last_patched_at=draft["last_patched_at"] if draft is not None else None,
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
    with connection() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
        version_body = validate_document(version["body"])
        draft = repository.get_draft(conn, version_id, user.id)
        return CurrentDocumentParts(
            version_body=version_body,
            version_etag=document_etag(version_body),
            version_locked=bool(version["locked"]),
            draft_body=validate_document(draft["body"]) if draft is not None else None,
            draft_etag=draft["draft_etag"] if draft is not None else None,
            last_patched_at=draft["last_patched_at"] if draft is not None else None,
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
