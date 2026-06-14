"""Project-scoped MCP tools for climate sources.

A read tool (``project:read``) and the default-toggle write tool
(``project:write``), mirroring the REST surface. Full create/patch/delete
stay browser-driven for now (matching the read-mostly project_location MCP
surface); agents attach sources rarely.
"""

from __future__ import annotations

from mcp.server.fastmcp import Context

from features.mcp.helpers import current_token, parse_uuid, project_access_or_error, raise_mcp_error
from features.project_climate_source.service import (
    list_project_climate_sources,
    set_default_climate_source,
)


def tool_list_project_climate_sources(project_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    """List the climate sources attached to one token-visible project."""
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    project_access_or_error(token, parsed_project_id, "project:read", ctx)
    return list_project_climate_sources(parsed_project_id).model_dump(mode="json")


def tool_set_project_climate_source_default(
    project_id: str, source_id: str, ctx: Context, *, allow_env_token: bool
) -> dict[str, object]:
    """Mark one of the project's climate sources as the default (project:write)."""
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_source_id = parse_uuid(source_id, "source_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:write", ctx)
    if access.user is None:
        raise_mcp_error("not_authenticated", "MCP token has no associated user.", "reauthenticate", ctx)
    return set_default_climate_source(parsed_project_id, parsed_source_id, access.user, None).model_dump(mode="json")
