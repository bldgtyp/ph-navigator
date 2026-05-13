"""REST routes for MCP token administration."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from features.mcp.models import McpTokenIssueRequest, McpTokenIssueResponse, McpTokenListResponse, McpTokenPublic
from features.mcp.service import issue_token, list_project_tokens, revoke_project_token
from features.projects.access import ProjectAccess, require_project_edit_access

router = APIRouter(prefix="/api/v1/projects/{project_id}/mcp-tokens", tags=["mcp-tokens"])

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
