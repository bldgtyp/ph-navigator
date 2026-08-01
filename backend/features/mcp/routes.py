"""REST routes for MCP token administration."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from features.auth.routes import CurrentUser
from features.mcp.models import McpTokenIssueRequest, McpTokenIssueResponse, McpTokenListResponse, McpTokenPublic
from features.mcp.service import (
    issue_token,
    issue_user_token,
    list_project_tokens,
    list_user_tokens,
    revoke_project_token,
    revoke_user_token,
)
from features.projects.access import ProjectAccess, require_project_edit_access

router = APIRouter(prefix="/api/v1/projects/{project_id}/mcp-tokens", tags=["mcp-tokens"])
agent_router = APIRouter(prefix="/api/v1/agent-tokens", tags=["agent-tokens"])

ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


@router.get("", response_model=McpTokenListResponse)
def list_tokens(access: ProjectEditAccess) -> McpTokenListResponse:
    return list_project_tokens(access)


@router.post("", response_model=McpTokenIssueResponse, status_code=201)
def create_token(
    payload: McpTokenIssueRequest,
    access: ProjectEditAccess,
    request: Request,
) -> McpTokenIssueResponse:
    return issue_token(payload, access, request)


@router.post("/{token_id}/revoke", response_model=McpTokenPublic)
def revoke_token(
    token_id: UUID,
    access: ProjectEditAccess,
    request: Request,
) -> McpTokenPublic:
    return revoke_project_token(token_id, access, request)


@agent_router.get("", response_model=McpTokenListResponse)
def list_agent_tokens(auth: CurrentUser) -> McpTokenListResponse:
    user, _expires_at = auth
    return list_user_tokens(user)


@agent_router.post("", response_model=McpTokenIssueResponse, status_code=201)
def create_agent_token(
    payload: McpTokenIssueRequest,
    auth: CurrentUser,
    request: Request,
) -> McpTokenIssueResponse:
    user, _expires_at = auth
    return issue_user_token(payload, user, request)


@agent_router.post("/{token_id}/revoke", response_model=McpTokenPublic)
def revoke_agent_token(
    token_id: UUID,
    auth: CurrentUser,
    request: Request,
) -> McpTokenPublic:
    user, _expires_at = auth
    return revoke_user_token(token_id, user, request)
