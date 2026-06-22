"""Project-scoped MCP tools for climate sources.

The read tool mirrors the REST list surface. Full create/patch/delete stay
browser-driven for now (matching the read-mostly project_location MCP surface);
agents attach sources rarely.
"""

from __future__ import annotations

from mcp.server.fastmcp import Context

from features.mcp.helpers import current_token, parse_uuid, project_access_or_error
from features.project_climate_source.service import list_project_climate_sources


def tool_list_project_climate_sources(project_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    """List the climate sources attached to one token-visible project."""
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    project_access_or_error(token, parsed_project_id, "project:read", ctx)
    return list_project_climate_sources(parsed_project_id).model_dump(mode="json")
