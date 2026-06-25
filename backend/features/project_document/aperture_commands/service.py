"""Service wrapper: dispatch one `ApertureCommand` against the editor's draft.

Mirrors ``apply_schema_mutation_to_draft`` — editor-only auth, locked-
version 409, ETag gating, lazy draft creation, audit-log persistence —
but routes the body update through the aperture dispatcher and resolves
the seeded catalog defaults from the live DB connection.
"""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from fastapi import Request
from psycopg import Connection

from features.project_document.aperture_commands.dispatcher import (
    apply_aperture_command,
)
from features.project_document.aperture_commands.models import (
    AUDIT_KIND_BY_APERTURE_COMMAND,
    ApertureCommand,
)
from features.project_document.apertures.default_refs import DatabaseDefaultsCatalog
from features.project_document.audit import log_document_action
from features.project_document.document import ProjectDocumentV1
from features.project_document.tables.apertures import (
    AperturesSliceResponse,
    apertures_response,
)
from features.project_document.write_spine import apply_document_write
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
    kind = command.kind  # type: ignore[union-attr]

    def mutate(conn: Connection[Any], base_body: ProjectDocumentV1) -> tuple[ProjectDocumentV1, dict[str, object]]:
        catalog = DatabaseDefaultsCatalog(conn)
        return apply_aperture_command(base_body, command, actor_user_id=user.id.hex, catalog=catalog)

    def on_persisted(conn: Connection[Any], details: dict[str, object] | None) -> None:
        log_document_action(
            conn,
            AUDIT_KIND_BY_APERTURE_COMMAND[kind],
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
        mutate=mutate,
        draft_etag_mismatch_message="The draft changed before this aperture command was applied.",
        updated_via=updated_via,
        on_persisted=on_persisted,
    )
    response = apertures_response(
        access.project_id,
        version_id,
        result.source,
        result.version_etag,
        result.draft_etag,
        result.body,
    )
    return response, result.details or {}
