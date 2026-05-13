"""Saved/draft document loading and table read helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import NoReturn
from uuid import UUID

from pydantic import BaseModel
from starlette import status

from database import connection
from features.project_document import repository
from features.project_document.document import ProjectDocumentV1
from features.project_document.models import ProjectDocumentView, ProjectDraftSummary
from features.project_document.tables import get_table_contract, iter_table_contracts
from features.project_document.validation import JsonValue, document_etag, raw_json_value, validate_document
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error


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
    return ProjectDraftSummary(
        project_id=access.project_id,
        version_id=version_id,
        source="draft" if parts.draft_body is not None else "version",
        version_etag=parts.version_etag,
        draft_etag=parts.draft_etag,
        dirty_tables=dirty_tables(parts.version_body, parts.draft_body) if parts.draft_body is not None else [],
        last_patched_at=parts.last_patched_at,
        is_locked=parts.version_locked,
        can_edit=not parts.version_locked,
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
