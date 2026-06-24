"""MCP tools for the Apertures feature.

Five tools, each a thin wrapper over an existing service:

  - ``list_aperture_types`` / ``get_aperture_type`` — read the apertures
    slice from the current draft (or saved) document.
  - ``report_aperture_catalog_drift`` — Phase 12 detector.
  - ``calculate_aperture_u_values`` — Phase 09 service.
  - ``apply_aperture_command`` — wraps the Phase 01 dispatcher through
    the same ``apply_aperture_command_to_draft`` editor-only service the
    browser uses (``updated_via="mcp"``). ETag preflight, locked-version
    rejection, audit envelope, and edit-lease policy all come for free.

No parallel mutation path; no parallel validation. Every Apertures rule
lives behind the dispatcher; this module is wiring.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from mcp.server.fastmcp import Context
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from features.aperture_drift.detector import detect_aperture_drift
from features.aperture_drift.models import ApertureDriftReport
from features.aperture_drift.reader import LiveCatalogReader
from features.aperture_u_value.service import calculate_aperture_u_values as _calc_u_values
from features.mcp.helpers import (
    current_token,
    parse_uuid,
    project_access_or_error,
    raise_http_exception_as_mcp_error,
    raise_mcp_error,
)
from features.mcp.models import McpRecoverability
from features.project_document.aperture_commands.models import ApertureCommand
from features.project_document.aperture_commands.service import (
    apply_aperture_command_to_draft,
)
from features.project_document.document import ApertureTypeEntry, ProjectDocumentV1
from features.project_document.models import ProjectDocumentSource
from features.project_document.store import load_document_body
from features.projects.access import ProjectAccess

# Per-error-code recoverability. ETag conflicts and locked versions tell
# the caller to refresh; validation errors are fatal so an LLM doesn't
# retry the same malformed payload.
_APPLY_RECOVERABILITY: dict[str, McpRecoverability] = {
    "draft_etag_mismatch": "refresh",
    "version_etag_mismatch": "refresh",
    "version_locked": "refresh",
    "project_version_not_found": "refresh",
    "aperture_type_not_found": "refresh",
    "aperture_element_not_found": "refresh",
}


# --------------------------- read tools -----------------------------------


def tool_list_aperture_types(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    """Return ``{ apertures: [{ id, name, element_count }] }`` for the
    chosen body. Read scope; viewers can call this."""

    body = _load_body(project_id, version_id, ctx, allow_env_token, source)
    return {
        "apertures": [
            {"id": apt.id, "name": apt.name, "element_count": len(apt.elements)} for apt in body.tables.apertures
        ]
    }


def tool_get_aperture_type(
    project_id: str,
    version_id: str,
    aperture_type_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    """Return one full ``ApertureTypeEntry``; unknown id → fatal."""

    body = _load_body(project_id, version_id, ctx, allow_env_token, source)
    entry = _find_aperture(body, aperture_type_id, ctx)
    return entry.model_dump(mode="json")


def tool_calculate_aperture_u_values(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    aperture_type_ids: list[str] | None = None,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    """Return one ``ApertureUValueResult`` per requested aperture; when
    ``aperture_type_ids`` is null, returns every aperture in the body."""

    body = _load_body(project_id, version_id, ctx, allow_env_token, source)
    targets = (
        body.tables.apertures
        if aperture_type_ids is None
        else [_find_aperture(body, atid, ctx) for atid in aperture_type_ids]
    )
    return {
        "apertures": [_calc_u_values(entry, body.tables).model_dump(mode="json") for entry in targets],
    }


def tool_report_aperture_catalog_drift(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    """Return the full ``ApertureDriftReport`` for the chosen body."""

    body = _load_body(project_id, version_id, ctx, allow_env_token, source)
    report: ApertureDriftReport = detect_aperture_drift(body, LiveCatalogReader())
    return report.model_dump(mode="json")


# --------------------------- write tool -----------------------------------


def tool_apply_aperture_command(
    project_id: str,
    version_id: str,
    command: dict[str, object],
    ctx: Context,
    *,
    allow_env_token: bool,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    """Apply one semantic aperture command (e.g. ``createApertureType``,
    ``pickFrame``, ``editDimension``, ``setManufacturerFilters``,
    ``refreshRefFromCatalog``) through the same draft-buffer dispatcher
    the browser uses. ``updated_via="mcp"`` tags the audit envelope.

    Returns the updated ``AperturesSliceResponse`` payload (envelope ETag
    plus apertures) and the per-command audit dict.
    """

    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:write", ctx)

    try:
        typed_command = _validate_command(command, ctx)
        response, audit = apply_aperture_command_to_draft(
            parsed_version_id,
            typed_command,
            access,
            if_match=if_match,
            if_match_version=if_match_version,
            request=None,
            updated_via="mcp",
        )
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="aperture_command_failed",
            default_message="Aperture command failed.",
            default_recoverability="fatal",
            recoverability_by_code=_APPLY_RECOVERABILITY,
        )
    return {"response": response.model_dump(mode="json"), "audit": audit}


# --------------------------- helpers --------------------------------------


def _load_body(
    project_id: str,
    version_id: str,
    ctx: Context,
    allow_env_token: bool,
    source: ProjectDocumentSource,
) -> ProjectDocumentV1:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
    return _read_body(parsed_version_id, access, source, ctx)


def _read_body(
    version_id: UUID,
    access: ProjectAccess,
    source: ProjectDocumentSource,
    ctx: Context,
) -> ProjectDocumentV1:
    try:
        return load_document_body(version_id, access, source)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_document_error",
            default_message="Project document could not be loaded.",
            default_recoverability="fatal",
            recoverability_by_code={"project_version_not_found": "refresh"},
        )


def _find_aperture(body: ProjectDocumentV1, aperture_type_id: str, ctx: Context) -> ApertureTypeEntry:
    for entry in body.tables.apertures:
        if entry.id == aperture_type_id:
            return entry
    raise_mcp_error(
        "aperture_type_not_found",
        "No aperture type matches the requested id.",
        "refresh",
        ctx,
        {"aperture_type_id": aperture_type_id},
    )


class _CommandEnvelope(BaseModel):
    """Single-field wrapper that lets Pydantic walk the discriminator on
    ``ApertureCommand`` — a bare ``Annotated`` union doesn't validate as
    a top-level model on its own. Hoisted to module scope so the class
    object isn't rebuilt on every ``apply_aperture_command`` call."""

    model_config = ConfigDict(extra="forbid")
    command: ApertureCommand = Field()


def _validate_command(payload: dict[str, object], ctx: Context) -> ApertureCommand:
    try:
        return _CommandEnvelope.model_validate({"command": payload}).command
    except ValidationError as exc:
        raise_mcp_error(
            "validation_error",
            "Aperture command failed validation.",
            "fatal",
            ctx,
            {"errors": [str(error.get("msg", error)) for error in exc.errors()]},
        )
