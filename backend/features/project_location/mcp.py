"""MCP read tool for project location metadata."""

from __future__ import annotations

from mcp.server.fastmcp import Context

from features.mcp.helpers import (
    current_token,
    parse_uuid,
    project_access_or_error,
)
from features.project_location.service import get_project_location


def tool_get_project_location(project_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    """Return SI-canonical location metadata for one token-visible project."""
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    project_access_or_error(token, parsed_project_id, "project:read", ctx)
    return get_project_location(parsed_project_id).model_dump(mode="json")
