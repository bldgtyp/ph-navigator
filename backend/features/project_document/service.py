"""Project-document draft workflow rules."""

from __future__ import annotations

import hashlib
import json
from uuid import UUID, uuid4

from pydantic import ValidationError
from starlette import status

from database import connection, transaction
from features.project_document import repository
from features.project_document.document import ROOM_OPTION_KEYS, ProjectDocumentV1
from features.project_document.models import (
    ProjectDocumentView,
    RoomsSliceReplaceRequest,
    RoomsSliceResponse,
    RoomsSliceSource,
)
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error


def document_etag(body: ProjectDocumentV1) -> str:
    payload = json.dumps(body.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def next_draft_etag(body: ProjectDocumentV1) -> str:
    payload = f"{document_etag(body)}:{uuid4()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


ROOMS_TABLE_NAME = "rooms"


def get_saved_rooms_slice(version_id: UUID, access: ProjectAccess) -> RoomsSliceResponse:
    with connection() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_version_not_found", "Project version not found.")
        version_body = validate_document(version["body"])
        version_etag = document_etag(version_body)

    return rooms_response(access.project_id, version_id, "version", version_etag, None, version_body)


def get_draft_rooms_slice(version_id: UUID, access: ProjectAccess) -> RoomsSliceResponse:
    document = get_current_document_view(version_id, access)
    return rooms_response(
        access.project_id,
        version_id,
        document.source,
        document.version_etag,
        document.draft_etag,
        document.body,
    )


def get_current_document_view(version_id: UUID, access: ProjectAccess) -> ProjectDocumentView:
    user = require_editor_user(access)
    with connection() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_version_not_found", "Project version not found.")
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


def replace_rooms_slice(
    version_id: UUID,
    payload: RoomsSliceReplaceRequest,
    access: ProjectAccess,
    if_match: str | None,
    if_match_version: str | None,
) -> RoomsSliceResponse:
    user = require_editor_user(access)

    with transaction() as conn:
        version = repository.get_project_version_for_update(conn, access.project_id, version_id)
        if version is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_version_not_found", "Project version not found.")
        if version["locked"]:
            raise api_error(status.HTTP_409_CONFLICT, "version_locked", "Locked versions cannot be edited.")

        version_body = validate_document(version["body"])
        version_etag = document_etag(version_body)
        draft = repository.get_draft_for_update(conn, version_id, user.id)

        if draft is None:
            if if_match_version != version_etag:
                raise api_error(
                    status.HTTP_409_CONFLICT,
                    "version_etag_mismatch",
                    "The saved version changed before this draft was created.",
                    {"expected": version_etag},
                )
            base_body = version_body
            base_version_etag = version_etag
        else:
            if if_match != draft["draft_etag"]:
                raise api_error(
                    status.HTTP_409_CONFLICT,
                    "draft_etag_mismatch",
                    "The draft changed before this Rooms update was applied.",
                    {"expected": draft["draft_etag"]},
                )
            base_body = validate_document(draft["body"])
            base_version_etag = draft["base_version_etag"]

        next_body = apply_rooms_replace(base_body, payload)
        draft_etag = next_draft_etag(next_body)
        draft_etag = repository.upsert_draft(
            conn,
            version_id,
            user.id,
            next_body,
            base_version_etag,
            draft_etag,
        )

    return rooms_response(
        access.project_id,
        version_id,
        "draft",
        version_etag,
        draft_etag,
        next_body,
    )


def require_rooms_table(table_name: str) -> None:
    if table_name != ROOMS_TABLE_NAME:
        raise api_error(status.HTTP_404_NOT_FOUND, "document_table_not_found", "Document table not found.")


def validate_document(raw_body: object) -> ProjectDocumentV1:
    try:
        return ProjectDocumentV1.model_validate(raw_body)
    except ValidationError as exc:
        raise api_error(
            422,
            "invalid_project_document",
            "Project document failed validation.",
            {"errors": [str(error["msg"]) for error in exc.errors()]},
        ) from exc


def apply_rooms_replace(body: ProjectDocumentV1, payload: RoomsSliceReplaceRequest) -> ProjectDocumentV1:
    options = dict(body.single_select_options)
    room_options = payload.single_select_options.by_option_key()
    for key in ROOM_OPTION_KEYS:
        options[key] = room_options[key]
    next_tables = body.tables.model_copy(update={"rooms": payload.rooms})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_document(next_body.model_dump(mode="json"))


def rooms_response(
    project_id: UUID,
    version_id: UUID,
    source: RoomsSliceSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> RoomsSliceResponse:
    return RoomsSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        rooms=body.tables.rooms,
        single_select_options={key: body.single_select_options.get(key, []) for key in ROOM_OPTION_KEYS},
    )
