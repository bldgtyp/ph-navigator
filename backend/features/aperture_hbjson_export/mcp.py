"""MCP read tool for the HBJSON window-constructions export.

``get_aperture_window_constructions(project_id, version_id, source?)``
returns the same payload the REST endpoint emits — a JSON object
keyed by escaped aperture-element identifier, each value the V1
``WindowConstruction.to_dict()`` shape.

Lives in the export module so it can be standalone (Phase 10), while
Phase 13's bulk semantic-write tools land in the central MCP tools
module alongside the other Apertures-feature writes.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from mcp.server.fastmcp import Context

from features.aperture_hbjson_export.service import export_aperture_window_constructions
from features.mcp.helpers import (
    current_token,
    parse_uuid,
    project_access_or_error,
    raise_http_exception_as_mcp_error,
)
from features.mcp.models import McpRecoverability
from features.project_document.models import ProjectDocumentSource
from features.project_document.store import (
    get_current_document_view,
    get_saved_document,
)

_RECOVERABILITY: dict[str, McpRecoverability] = {
    "aperture_hbjson_identifier_collision": "fatal",
    "aperture_hbjson_identifier_empty": "fatal",
    "project_version_not_found": "refresh",
}


def tool_get_aperture_window_constructions(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, dict[str, Any]]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
    try:
        if source == "version":
            body = get_saved_document(parsed_version_id, access)
        else:
            body = get_current_document_view(parsed_version_id, access).body
        return export_aperture_window_constructions(body)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="aperture_hbjson_export_failed",
            default_message="Aperture window constructions could not be exported.",
            default_recoverability="fatal",
            recoverability_by_code=_RECOVERABILITY,
        )
