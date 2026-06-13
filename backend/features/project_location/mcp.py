"""MCP read tool for project location metadata."""

from __future__ import annotations

from mcp.server.fastmcp import Context

from features.mcp.helpers import (
    current_token,
    parse_uuid,
    project_access_or_error,
)
from features.project_location.service import get_project_location, get_project_sun_path


def tool_get_project_location(project_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    """Return SI-canonical location metadata for one token-visible project."""
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    project_access_or_error(token, parsed_project_id, "project:read", ctx)
    return get_project_location(parsed_project_id).model_dump(mode="json")


def tool_get_project_sun_path(project_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object] | None:
    """Return the project's sun-path + compass diagram, or None when location is unset."""
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    project_access_or_error(token, parsed_project_id, "project:read", ctx)
    sun_path = get_project_sun_path(parsed_project_id)
    return sun_path.model_dump(mode="json") if sun_path is not None else None
