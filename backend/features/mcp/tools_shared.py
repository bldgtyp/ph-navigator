"""Shared helpers for MCP tool implementations."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from mcp.server.fastmcp import Context

from database import connection
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import public_user
from features.mcp.helpers import raise_http_exception_as_mcp_error, raise_mcp_error
from features.projects.models import AccessMode, ProjectDetail
from features.projects.service import get_project_detail


def get_project_detail_or_error(project_id: UUID, access_mode: AccessMode, ctx: Context) -> ProjectDetail:
    try:
        return get_project_detail(project_id, access_mode=access_mode)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_error",
            default_message="Project could not be loaded.",
            default_recoverability="refresh",
            recoverability_by_code={"project_deleted": "refresh", "project_not_found": "refresh"},
        )


def token_user_or_error(user_id: UUID, ctx: Context) -> UserPublic:
    with connection() as conn:
        row = auth_repository.get_user_by_id(conn, user_id)
    if row is None or not row["is_active"]:
        raise_mcp_error(
            "mcp_issuing_user_not_found",
            "MCP token issuing user is no longer active.",
            "reauthenticate",
            ctx,
        )
    return public_user(row)
