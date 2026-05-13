"""Draft table replacement, Save, Save As, and Discard workflows."""

from __future__ import annotations

from uuid import UUID

from fastapi import Request
from psycopg.errors import UniqueViolation
from pydantic import BaseModel
from starlette import status

from database import transaction
from features.project_document import repository
from features.project_document.audit import log_document_action
from features.project_document.models import (
    AUTO_LOCKED_VERSION_KINDS,
    DiscardDraftResponse,
    SaveAsDraftRequest,
    SaveDraftResponse,
)
from features.project_document.store import raise_project_version_not_found
from features.project_document.tables import get_table_contract
from features.project_document.validation import body_size_bytes, document_etag, next_draft_etag, validate_document
from features.projects.access import ProjectAccess, require_editor_user
from features.projects.service import version_public
from features.shared.errors import api_error


def replace_table_slice(
    version_id: UUID,
    table_name: str,
    raw_payload: object,
    access: ProjectAccess,
    if_match: str | None,
    if_match_version: str | None,
) -> BaseModel:
    user = require_editor_user(access)
    contract = get_table_contract(table_name)
    payload = contract.parse_replace_payload(raw_payload)

    with transaction() as conn:
        version = repository.get_project_version_for_update(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
        if version["locked"]:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "version_locked",
                "Locked versions cannot be edited.",
            )

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
                    "The draft changed before this table update was applied.",
                    {"expected": draft["draft_etag"]},
                )
            base_body = validate_document(draft["body"])
            base_version_etag = draft["base_version_etag"]

        next_body = contract.apply_replace(base_body, payload)
        if next_body == base_body:
            return contract.build_response(
                access.project_id,
                version_id,
                "draft" if draft is not None else "version",
                version_etag,
                draft["draft_etag"] if draft is not None else None,
                base_body,
            )

        draft_etag = repository.upsert_draft(
            conn,
            version_id,
            user.id,
            next_body,
            base_version_etag,
            next_draft_etag(next_body),
        )

    return contract.build_response(access.project_id, version_id, "draft", version_etag, draft_etag, next_body)


def save_draft(version_id: UUID, access: ProjectAccess, if_match: str | None, request: Request) -> SaveDraftResponse:
    user = require_editor_user(access)

    with transaction() as conn:
        version = repository.get_project_version_for_update(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
        if version["locked"]:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "version_locked",
                "Locked versions cannot be saved.",
            )

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
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "validation_error",
            "Version name is required.",
        )
    locked = payload.locked or payload.kind in AUTO_LOCKED_VERSION_KINDS

    try:
        with transaction() as conn:
            version = repository.get_project_version_for_update(conn, access.project_id, version_id)
            if version is None:
                raise_project_version_not_found()
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
            log_document_action(
                conn,
                "project_version_save_as",
                access,
                saved_row["id"],
                user.id,
                request,
            )
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
