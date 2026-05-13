"""Project-document draft workflow rules."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable
from typing import Any
from uuid import UUID, uuid4

from fastapi import Request
from psycopg.errors import UniqueViolation
from pydantic import ValidationError
from starlette import status

from database import connection, transaction
from features.auth import repository as auth_repository
from features.auth.service import client_ip, user_agent
from features.project_document import repository
from features.project_document.document import ROOM_OPTION_KEYS, ProjectDocumentV1
from features.project_document.models import (
    DiscardDraftResponse,
    ProjectDiffResponse,
    ProjectDocumentView,
    RoomsSliceReplaceRequest,
    RoomsSliceResponse,
    RoomsSliceSource,
    SaveAsDraftRequest,
    SaveDraftResponse,
    TableDiffSummary,
    VersionPatchRequest,
)
from features.projects.access import ProjectAccess, require_editor_user
from features.projects.models import ProjectDetail
from features.projects.service import body_size_bytes, get_project_detail, version_public
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


def get_saved_document(version_id: UUID, access: ProjectAccess) -> ProjectDocumentV1:
    with connection() as conn:
        version = repository.get_project_version(conn, access.project_id, version_id)
        if version is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_version_not_found", "Project version not found.")
        return validate_document(version["body"])


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


def save_draft(version_id: UUID, access: ProjectAccess, if_match: str | None, request: Request) -> SaveDraftResponse:
    user = require_editor_user(access)

    with transaction() as conn:
        version = repository.get_project_version_for_update(conn, access.project_id, version_id)
        if version is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_version_not_found", "Project version not found.")
        if version["locked"]:
            raise api_error(status.HTTP_409_CONFLICT, "version_locked", "Locked versions cannot be saved.")

        version_body = validate_document(version["body"])
        version_etag = document_etag(version_body)
        if if_match != version_etag:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "version_etag_mismatch",
                "The saved version changed before this draft could be saved.",
                {"expected": version_etag},
            )

        draft = repository.get_draft_for_update(conn, version_id, user.id)
        if draft is None:
            raise api_error(status.HTTP_409_CONFLICT, "draft_not_found", "No draft exists to save.")

        draft_body = validate_document(draft["body"])
        saved_row = repository.save_draft_to_version(
            conn,
            access.project_id,
            version_id,
            user.id,
            draft_body,
            body_size_bytes(draft_body),
        )
        repository.delete_draft(conn, version_id, user.id)
        log_document_action(conn, "project_version_save", access, version_id, user.id, request)

    version_public_model = version_public(saved_row)
    return SaveDraftResponse(
        project_id=access.project_id,
        version=version_public_model,
        version_etag=document_etag(draft_body),
    )


def save_draft_as(
    version_id: UUID,
    payload: SaveAsDraftRequest,
    access: ProjectAccess,
    request: Request,
) -> SaveDraftResponse:
    user = require_editor_user(access)
    version_name = payload.name.strip()
    if not version_name:
        raise api_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "validation_error", "Version name is required.")
    locked = payload.locked or payload.kind in {"submitted", "closed"}

    try:
        with transaction() as conn:
            version = repository.get_project_version_for_update(conn, access.project_id, version_id)
            if version is None:
                raise api_error(status.HTTP_404_NOT_FOUND, "project_version_not_found", "Project version not found.")
            version_body = validate_document(version["body"])
            draft = repository.get_draft_for_update(conn, version_id, user.id)
            source_body = validate_document(draft["body"]) if draft is not None else version_body
            saved_row = repository.insert_version_from_body(
                conn,
                access.project_id,
                version_id,
                user.id,
                version_name,
                payload.kind,
                locked,
                source_body,
                body_size_bytes(source_body),
            )
            repository.delete_draft(conn, version_id, user.id)
            log_document_action(conn, "project_version_save_as", access, saved_row["id"], user.id, request)
    except UniqueViolation as exc:
        if exc.diag.constraint_name != "uq_project_versions_project_name":
            raise
        raise api_error(
            status.HTTP_409_CONFLICT,
            "version_name_taken",
            "A version with that name already exists for this project.",
        ) from exc

    version_public_model = version_public(saved_row)
    return SaveDraftResponse(
        project_id=access.project_id,
        version=version_public_model,
        version_etag=document_etag(source_body),
    )


def discard_draft(version_id: UUID, access: ProjectAccess) -> DiscardDraftResponse:
    user = require_editor_user(access)
    with transaction() as conn:
        discarded = repository.delete_draft(conn, version_id, user.id)
    return DiscardDraftResponse(project_id=access.project_id, version_id=version_id, discarded=discarded)


def patch_version(
    version_id: UUID,
    payload: VersionPatchRequest,
    access: ProjectAccess,
    request: Request,
) -> ProjectDetail:
    user = require_editor_user(access)
    if payload.locked is None and not payload.make_active:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "validation_error", "No version metadata change supplied."
        )

    with transaction() as conn:
        version = repository.get_project_version_for_update(conn, access.project_id, version_id)
        if version is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_version_not_found", "Project version not found.")
        repository.patch_version_metadata(
            conn,
            access.project_id,
            version_id,
            user.id,
            payload.locked,
            make_active=bool(payload.make_active),
        )
        log_document_action(conn, "project_version_patch", access, version_id, user.id, request)

    return get_project_detail(access.project_id, access_mode="editor")


def get_project_diff(
    from_version_id: UUID,
    to_value: str,
    access: ProjectAccess,
) -> ProjectDiffResponse:
    from_body = get_saved_document(from_version_id, access)
    if to_value == "draft":
        current = get_current_document_view(from_version_id, access)
        to_body = current.body
        to_version_id: UUID | str = "draft"
    else:
        try:
            to_version_id = UUID(to_value)
        except ValueError as exc:
            raise api_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "validation_error", "Invalid diff target.") from exc
        to_body = get_saved_document(to_version_id, access)

    tables = [
        table_diff_summary(
            "rooms",
            from_body.model_dump(mode="json")["tables"]["rooms"],
            to_body.model_dump(mode="json")["tables"]["rooms"],
        )
    ]
    return ProjectDiffResponse(
        project_id=access.project_id,
        from_version_id=from_version_id,
        to_version_id=to_version_id,
        tables=tables,
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


def log_document_action(
    conn: Any,
    action: str,
    access: ProjectAccess,
    version_id: UUID,
    user_id: UUID,
    request: Request,
) -> None:
    auth_repository.log_action(
        conn,
        action=action,
        user_id=user_id,
        email=access.user.email if access.user else None,
        session_id=None,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
        details={"project_id": str(access.project_id), "version_id": str(version_id)},
    )


def table_diff_summary(table: str, before: Any, after: Any) -> TableDiffSummary:
    changed_paths = sorted(diff_paths(before, after, table))
    return TableDiffSummary(table=table, change_count=len(changed_paths), changed_paths=changed_paths)


def diff_paths(before: Any, after: Any, path: str = "") -> set[str]:
    if before == after:
        return set()
    if isinstance(before, dict) and isinstance(after, dict):
        keys = set(before) | set(after)
        return {
            changed
            for key in keys
            for changed in diff_paths(before.get(key), after.get(key), f"{path}.{key}" if path else str(key))
        }
    if isinstance(before, list) and isinstance(after, list):
        return diff_list_paths(before, after, path)
    return {path or "$"}


def diff_list_paths(before: list[Any], after: list[Any], path: str) -> set[str]:
    before_by_id = rows_by_id(before)
    after_by_id = rows_by_id(after)
    if before_by_id is None or after_by_id is None:
        return {path or "$"}
    changed: set[str] = set()
    for row_id in set(before_by_id) | set(after_by_id):
        row_path = f"{path}[{row_id}]" if path else f"[{row_id}]"
        changed.update(diff_paths(before_by_id.get(row_id), after_by_id.get(row_id), row_path))
    return changed


def rows_by_id(rows: Iterable[Any]) -> dict[str, Any] | None:
    keyed: dict[str, Any] = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str):
            return None
        keyed[row["id"]] = row
    return keyed


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
