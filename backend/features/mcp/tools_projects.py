"""Project and status MCP tools."""

from __future__ import annotations

from fastapi import HTTPException
from mcp.server.fastmcp import Context

from features.mcp.helpers import (
    current_token,
    parse_uuid,
    project_access_or_error,
    raise_http_exception_as_mcp_error,
    require_token_scope_or_error,
)
from features.mcp.models import (
    McpProjectEnvelope,
    McpProjectListEnvelope,
    McpStatusItemListEnvelope,
    McpVersionListEnvelope,
)
from features.mcp.tools_shared import get_project_detail_or_error, token_user_or_error
from features.project_status.service import list_project_status_items
from features.projects.models import ProjectDeleteRequest, ProjectHardDeleteRequest, ProjectSummary
from features.projects.service import delete_project as soft_delete_project
from features.projects.service import hard_delete_project, restore_project

__all__ = [
    "tool_delete_project",
    "tool_get_project",
    "tool_hard_delete_project",
    "tool_list_projects",
    "tool_list_status_items",
    "tool_list_versions",
    "tool_restore_project",
]


def tool_list_projects(ctx: Context, *, allow_env_token: bool) -> McpProjectListEnvelope:
    token = current_token(ctx, allow_env_token)
    detail = get_project_detail_or_error(token.project_id, "viewer", ctx)
    project = ProjectSummary.model_validate(
        detail.model_dump(exclude={"versions", "active_version", "access_mode", "owner_display_name"})
    )
    return McpProjectListEnvelope(projects=[project])


def tool_get_project(project_id: str, ctx: Context, *, allow_env_token: bool) -> McpProjectEnvelope:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    require_token_scope_or_error(token, parsed_project_id, "project:read", ctx)
    detail = get_project_detail_or_error(parsed_project_id, "editor", ctx)
    return McpProjectEnvelope(
        project=ProjectSummary.model_validate(
            detail.model_dump(exclude={"versions", "active_version", "access_mode", "owner_display_name"})
        ),
        active_version=detail.active_version,
        versions=detail.versions,
    )


def tool_list_versions(project_id: str, ctx: Context, *, allow_env_token: bool) -> McpVersionListEnvelope:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    require_token_scope_or_error(token, parsed_project_id, "project:read", ctx)
    detail = get_project_detail_or_error(parsed_project_id, "editor", ctx)
    return McpVersionListEnvelope(versions=detail.versions)


def tool_delete_project(project_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    require_token_scope_or_error(token, parsed_project_id, "project:write", ctx)
    user = token_user_or_error(token.issued_by_user_id, ctx)
    try:
        return soft_delete_project(
            parsed_project_id,
            ProjectDeleteRequest(confirm=True),
            user,
            request_meta=None,
        ).model_dump(mode="json")
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_delete_failed",
            default_message="Project delete failed.",
            default_recoverability="fatal",
        )


def tool_restore_project(project_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    require_token_scope_or_error(token, parsed_project_id, "project:write", ctx)
    user = token_user_or_error(token.issued_by_user_id, ctx)
    try:
        return restore_project(parsed_project_id, user, request_meta=None).model_dump(mode="json")
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_restore_failed",
            default_message="Project restore failed.",
            default_recoverability="fatal",
            recoverability_by_code={"project_restore_expired": "fatal", "project_not_found": "refresh"},
        )


def tool_hard_delete_project(
    project_id: str,
    confirm_project_name: str,
    confirm_bt_number: str,
    ctx: Context,
    *,
    allow_env_token: bool,
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    require_token_scope_or_error(token, parsed_project_id, "project:write", ctx)
    user = token_user_or_error(token.issued_by_user_id, ctx)
    try:
        return hard_delete_project(
            parsed_project_id,
            ProjectHardDeleteRequest(
                confirm_project_name=confirm_project_name,
                confirm_bt_number=confirm_bt_number,
            ),
            user=user,
            request_meta=None,
        ).model_dump(mode="json")
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_hard_delete_failed",
            default_message="Project hard-delete failed.",
            default_recoverability="fatal",
            recoverability_by_code={
                "project_not_found": "refresh",
                "project_hard_delete_storage_partial_failure": "retry",
            },
        )


def tool_list_status_items(project_id: str, ctx: Context, *, allow_env_token: bool) -> McpStatusItemListEnvelope:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
    response = list_project_status_items(access)
    return McpStatusItemListEnvelope(items=response.items)
