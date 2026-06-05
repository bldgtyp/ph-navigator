"""Service wrapper: dispatch one `ApertureCommand` against the editor's draft.

Mirrors ``apply_schema_mutation_to_draft`` — editor-only auth, locked-
version 409, ETag gating, lazy draft creation, audit-log persistence —
but routes the body update through the aperture dispatcher and resolves
the seeded catalog defaults from the live DB connection.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import Request

from database import transaction
from features.project_document import repository
from features.project_document.aperture_commands.dispatcher import (
    apply_aperture_command,
)
from features.project_document.aperture_commands.models import (
    AUDIT_KIND_BY_APERTURE_COMMAND,
    ApertureCommand,
)
from features.project_document.apertures.default_refs import DatabaseDefaultsCatalog
from features.project_document.audit import log_document_action
from features.project_document.drafts import load_draft_context
from features.project_document.tables.apertures import (
    AperturesSliceResponse,
    apertures_response,
)
from features.project_document.validation import document_etag, next_draft_etag
from features.projects.access import ProjectAccess, require_editor_user


def apply_aperture_command_to_draft(
    version_id: UUID,
    command: ApertureCommand,
    access: ProjectAccess,
    *,
    if_match: str | None,
    if_match_version: str | None,
    request: Request | None,
    updated_via: Literal["browser", "mcp"] = "browser",
) -> tuple[AperturesSliceResponse, dict[str, object]]:
    user = require_editor_user(access)

    with transaction() as conn:
        base_body, base_version_etag, version_etag, draft = load_draft_context(
            conn,
            access.project_id,
            version_id,
            user.id,
            if_match,
            if_match_version,
            draft_etag_mismatch_message="The draft changed before this aperture command was applied.",
        )

        catalog = DatabaseDefaultsCatalog(conn)
        next_body, audit_payload = apply_aperture_command(
            base_body,
            command,
            actor_user_id=user.id.hex,
            catalog=catalog,
        )

        if next_body == base_body:
            response = apertures_response(
                access.project_id,
                version_id,
                "draft" if draft is not None else "version",
                version_etag,
                draft["draft_etag"] if draft is not None else None,
                base_body,
            )
            return response, audit_payload

        draft_etag = repository.upsert_draft(
            conn,
            version_id,
            user.id,
            next_body,
            base_version_etag,
            next_draft_etag(next_body),
            updated_via=updated_via,
        )

        kind = command.kind  # type: ignore[union-attr]
        log_document_action(
            conn,
            AUDIT_KIND_BY_APERTURE_COMMAND[kind],
            access,
            version_id,
            user.id,
            request,
            extra_details={**audit_payload, "updated_via": updated_via},
        )

    # `document_etag` is left available for callers that want to advertise
    # the new saved etag separately; the response envelope itself carries
    # version_etag (the saved-side ETag, unchanged here) and draft_etag.
    _ = document_etag
    response = apertures_response(
        access.project_id,
        version_id,
        "draft",
        version_etag,
        draft_etag,
        next_body,
    )
    return response, audit_payload
