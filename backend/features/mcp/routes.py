"""REST routes for MCP token administration."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from features.auth.routes import CurrentUser
from features.mcp.models import (
    McpDeviceAuthorizationDecision,
    McpDeviceAuthorizationPollRequest,
    McpDeviceAuthorizationPollResponse,
    McpDeviceAuthorizationPublic,
    McpDeviceAuthorizationRequest,
    McpDeviceAuthorizationStart,
    McpTokenIssueRequest,
    McpTokenIssueResponse,
    McpTokenListResponse,
    McpTokenPublic,
)
from features.mcp.rate_limit import enforce_device_poll_budget, enforce_device_start_budget
from features.mcp.service import (
    decide_device_authorization,
    get_device_authorization,
    issue_token,
    issue_user_token,
    list_project_tokens,
    list_user_tokens,
    poll_device_authorization,
    revoke_project_token,
    revoke_user_token,
    start_device_authorization,
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


@agent_router.post(
    "/device",
    response_model=McpDeviceAuthorizationStart,
    status_code=201,
    dependencies=[Depends(enforce_device_start_budget)],
)
def create_device_authorization(
    payload: McpDeviceAuthorizationRequest,
) -> McpDeviceAuthorizationStart:
    return start_device_authorization(payload)


@agent_router.post(
    "/device/poll",
    response_model=McpDeviceAuthorizationPollResponse,
    dependencies=[Depends(enforce_device_poll_budget)],
)
def poll_agent_device_authorization(
    payload: McpDeviceAuthorizationPollRequest,
    request: Request,
) -> McpDeviceAuthorizationPollResponse:
    return poll_device_authorization(payload.device_code, request)


@agent_router.get("/device/{user_code}", response_model=McpDeviceAuthorizationPublic)
def read_device_authorization(
    user_code: str,
    auth: CurrentUser,
) -> McpDeviceAuthorizationPublic:
    _user, _expires_at = auth
    return get_device_authorization(user_code)


@agent_router.post("/device/{user_code}", response_model=McpDeviceAuthorizationPublic)
def decide_agent_device_authorization(
    user_code: str,
    payload: McpDeviceAuthorizationDecision,
    auth: CurrentUser,
    request: Request,
) -> McpDeviceAuthorizationPublic:
    user, _expires_at = auth
    return decide_device_authorization(user_code, payload, user, request)
