"""Draft table replacement, Save, Save As, and Discard workflows."""

from __future__ import annotations

from typing import Any, Literal, cast
from uuid import UUID

from fastapi import Request
from psycopg import Connection
from psycopg.errors import UniqueViolation
from pydantic import BaseModel
from starlette import status

from database import transaction
from features.assets.reference_validation import validate_document_asset_references
from features.project_document import repository
from features.project_document.audit import log_document_action
from features.project_document.document import ProjectDocumentV1
from features.project_document.models import (
    AUTO_LOCKED_VERSION_KINDS,
    DiscardDraftResponse,
    SaveAsDraftRequest,
    SaveDraftResponse,
)
from features.project_document.schema_mutations import (
    AUDIT_KIND_BY_MUTATION,
    FieldSchemaMutation,
)
from features.project_document.store import raise_project_version_not_found
from features.project_document.tables import get_table_contract
from features.project_document.tables.contracts import (
    CascadePreviewRef,
    TableReplacePreviewResponse,
    read_table_envelope,
)
from features.project_document.tables.dependent_links import preview_dependent_link_cascade
from features.project_document.validation import (
    document_etag,
    enforce_document_body_size,
    validate_document,
)
from features.project_document.write_spine import apply_document_write, load_draft_context
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

    result = apply_document_write(
        access,
        version_id,
        user.id,
        if_match=if_match,
        if_match_version=if_match_version,
        mutate=lambda _conn, base_body: (contract.apply_replace(base_body, payload), None),
        draft_etag_mismatch_message="The draft changed before this table update was applied.",
        validate_asset_references=True,
    )
    return contract.build_response(
        access.project_id,
        version_id,
        result.source,
        result.version_etag,
        result.draft_etag,
        result.body,
    )


def preview_table_replace(
    version_id: UUID,
    table_name: str,
    raw_payload: object,
    access: ProjectAccess,
    if_match: str | None,
    if_match_version: str | None,
) -> TableReplacePreviewResponse:
    """Dry-run a table replace: report the dependent links the removed rows would
    clear, without persisting. A removed row still held by a *required* dependent
    link raises the same 409 the real write would. Generic — any contract with
    `dependent_links` (today: the heat-pump leaves) gets a delete-cascade preview.
    """
    user = require_editor_user(access)
    contract = get_table_contract(table_name)
    payload = contract.parse_replace_payload(raw_payload)

    with transaction() as conn:
        base_body, _base_version_etag, _version_etag, _draft = load_draft_context(
            conn,
            access.project_id,
            version_id,
            user.id,
            if_match,
            if_match_version,
            draft_etag_mismatch_message="The draft changed before this delete preview was computed.",
        )
        # `apply_replace` normalizes the payload into a body (validating it and
        # raising 409 on a required-link block) so the removed set is derived the
        # same way the real write derives it.
        next_body = contract.apply_replace(base_body, payload)
        removed = _table_row_ids(base_body, contract.table_path) - _table_row_ids(next_body, contract.table_path)
        affected = preview_dependent_link_cascade(
            base_body,
            table_path=contract.table_path,
            removed=removed,
            dependent_links=contract.dependent_links,
        )
    return TableReplacePreviewResponse(affected=[CascadePreviewRef(**ref.as_dict()) for ref in affected])


def _table_row_ids(body: ProjectDocumentV1, table_path: tuple[str, ...]) -> set[str]:
    return {row.id for row in cast(Any, read_table_envelope(body, table_path)).rows}


def apply_schema_mutation_to_draft(
    version_id: UUID,
    table_name: str,
    mutation: FieldSchemaMutation,
    access: ProjectAccess,
    *,
    if_match: str | None,
    if_match_version: str | None,
    request: Request | None,
    updated_via: Literal["browser", "mcp"] = "browser",
) -> tuple[BaseModel, dict[str, object]]:
    """Apply one `FieldSchemaMutation` to the editor's draft (plan-15 P2.2).

    Mirrors `replace_table_slice` — editor-only auth, locked-version
    409, ETag gating, lazy draft creation — but the body update goes
    through `contract.custom_fields.apply_schema_mutation` so plan-15
    P2.1's typed validation and audit payload land. Per
    `save-versioning.md` §8.3 the mutation is rejected before any
    state change if the per-table preflight fails (immediate draft
    validation).

    `updated_via` channels the MCP edit-lease primitive (plan-15
    P2.3 / save-versioning.md §8.5): MCP writes set
    ``updated_via='mcp'`` so the persisted draft row is tagged and
    the audit log carries the channel in `details`. The richer
    lease semantics (lease_id, expiration window, browser
    indicator) layer on top of this column in a follow-up.

    `request` is optional — MCP callers don't have a FastAPI
    `Request` in hand; the audit log row then stores `NULL` for
    `ip_address` / `user_agent`.
    """
    user = require_editor_user(access)
    contract = get_table_contract(table_name)
    if contract.custom_fields is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "custom_field_unsupported_table",
            "This table does not support custom fields.",
            {"table_key": table_name},
        )
    if mutation.table_key != table_name:
        # Sanity gate — the route's path table_name and the payload's
        # table_key must agree. The mutation service relies on the
        # capability we just looked up by `table_name`; a mismatch
        # would silently apply against the wrong table.
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "custom_field_invalid_field_id",
            "Mutation table_key does not match the path table_name.",
            {"table_key": mutation.table_key, "path_table_name": table_name},
        )

    custom_fields = contract.custom_fields

    def on_persisted(conn: Connection[Any], details: dict[str, object] | None) -> None:
        # `setDescription` to the same value is the only no-op mutation; on a
        # real write we audit-log the typed action with the mutation channel.
        log_document_action(
            conn,
            AUDIT_KIND_BY_MUTATION[mutation.kind],
            access,
            version_id,
            user.id,
            request,
            extra_details={**(details or {}), "updated_via": updated_via},
        )

    result = apply_document_write(
        access,
        version_id,
        user.id,
        if_match=if_match,
        if_match_version=if_match_version,
        mutate=lambda _conn, base_body: custom_fields.apply_schema_mutation(base_body, mutation, user.id.hex),
        draft_etag_mismatch_message="The draft changed before this schema mutation was applied.",
        updated_via=updated_via,
        on_persisted=on_persisted,
    )
    # The audit payload is passed through even on a no-op so the caller
    # (REST / MCP) can surface "no-op" diagnostics if it wants.
    response = contract.build_response(
        access.project_id,
        version_id,
        result.source,
        result.version_etag,
        result.draft_etag,
        result.body,
    )
    return response, result.details or {}


def save_draft(
    version_id: UUID,
    access: ProjectAccess,
    if_match: str | None,
    request: Request | None,
    *,
    updated_via: Literal["browser", "mcp"] = "browser",
) -> SaveDraftResponse:
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
        validate_document_asset_references(conn, project_id=access.project_id, body=draft_body)
        serialized_draft = enforce_document_body_size(draft_body)
        saved_row = repository.save_draft_to_version(
            conn,
            access.project_id,
            version_id,
            user.id,
            draft_body,
            serialized_draft.size_bytes,
            serialized_body=serialized_draft,
        )
        repository.delete_draft(conn, version_id, user.id)
        log_document_action(
            conn,
            "project_version_save",
            access,
            version_id,
            user.id,
            request,
            extra_details={"updated_via": updated_via},
        )

    version_public_model = version_public(saved_row)
    return SaveDraftResponse(
        project_id=access.project_id,
        version=version_public_model,
        version_etag=serialized_draft.etag,
    )


def save_draft_as(
    version_id: UUID,
    payload: SaveAsDraftRequest,
    access: ProjectAccess,
    request: Request | None,
) -> SaveDraftResponse:
    user = require_editor_user(access)
    version_name = payload.name.strip()
    if not version_name:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
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
            validate_document_asset_references(conn, project_id=access.project_id, body=source_body)
            serialized_source = enforce_document_body_size(source_body)
            saved_row = repository.insert_version_from_body(
                conn,
                access.project_id,
                version_id,
                user.id,
                version_name,
                payload.kind,
                locked,
                source_body,
                serialized_source.size_bytes,
                serialized_body=serialized_source,
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
        version_etag=serialized_source.etag,
    )


def discard_draft(version_id: UUID, access: ProjectAccess) -> DiscardDraftResponse:
    user = require_editor_user(access)
    with transaction() as conn:
        discarded = repository.delete_draft(conn, version_id, user.id)
    return DiscardDraftResponse(project_id=access.project_id, version_id=version_id, discarded=discarded)
