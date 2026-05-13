"""Saved/draft document loading and table read helpers."""

from __future__ import annotations

from typing import NoReturn
from uuid import UUID

from pydantic import BaseModel
from starlette import status

from database import connection
from features.project_document import repository
from features.project_document.document import ProjectDocumentV1
from features.project_document.models import ProjectDocumentView
from features.project_document.tables import get_table_contract
from features.project_document.validation import JsonValue, document_etag, raw_json_value, validate_document
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error


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
    user = require_editor_user(access)
    with connection() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
        version_body = validate_document(version["body"])
        version_etag = document_etag(version_body)
        draft = repository.get_draft(conn, version_id, user.id)
        if draft is not None:
            draft_body = validate_document(draft["body"])
            return ProjectDocumentView(
                project_id=access.project_id,
                version_id=version_id,
                source="draft",
                version_etag=version_etag,
                draft_etag=draft["draft_etag"],
                body=draft_body,
            )

    return ProjectDocumentView(
        project_id=access.project_id,
        version_id=version_id,
        source="version",
        version_etag=version_etag,
        draft_etag=None,
        body=version_body,
    )


def get_saved_and_current_document_view(
    version_id: UUID, access: ProjectAccess
) -> tuple[ProjectDocumentV1, ProjectDocumentView]:
    with connection() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
        version_body = validate_document(version["body"])
        version_etag = document_etag(version_body)

        user = require_editor_user(access)
        draft = repository.get_draft(conn, version_id, user.id)
        if draft is not None:
            draft_body = validate_document(draft["body"])
            return version_body, ProjectDocumentView(
                project_id=access.project_id,
                version_id=version_id,
                source="draft",
                version_etag=version_etag,
                draft_etag=draft["draft_etag"],
                body=draft_body,
            )

    return version_body, ProjectDocumentView(
        project_id=access.project_id,
        version_id=version_id,
        source="version",
        version_etag=version_etag,
        draft_etag=None,
        body=version_body,
    )


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


def raise_project_version_not_found() -> NoReturn:
    raise api_error(
        status.HTTP_404_NOT_FOUND,
        "project_version_not_found",
        "Project version not found.",
    )
