"""Workflow rules for MCP tokens and read-only tool calls."""

from __future__ import annotations

import hashlib
import secrets
from uuid import UUID

from fastapi import Request
from mcp.server.auth.provider import AccessToken, TokenVerifier
from starlette import status
from starlette.concurrency import run_in_threadpool

from database import connection, transaction
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import client_ip, now_utc, user_agent
from features.mcp import repository
from features.mcp.models import (
    McpScope,
    McpTokenIssueRequest,
    McpTokenIssueResponse,
    McpTokenListResponse,
    McpTokenPublic,
    McpTokenRecord,
)
from features.projects import repository as projects_repository
from features.projects.access import ProjectAccess, require_editor_user
from features.projects.models import ProjectSummary
from features.shared.errors import api_error

TOKEN_PREFIX_LENGTH = 16


def generate_plaintext_token() -> str:
    return f"phn_mcp_{secrets.token_urlsafe(32)}"


def token_hash(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def token_prefix(plaintext: str) -> str:
    return plaintext[:TOKEN_PREFIX_LENGTH]


def token_public(row: dict[str, object]) -> McpTokenPublic:
    public_fields = McpTokenPublic.model_fields.keys()
    return McpTokenPublic.model_validate({key: row[key] for key in public_fields})


def token_record(row: dict[str, object]) -> McpTokenRecord:
    return McpTokenRecord.model_validate(row)


def issue_token(
    payload: McpTokenIssueRequest,
    access: ProjectAccess,
    request_meta: Request,
) -> McpTokenIssueResponse:
    """Create a project-scoped bearer token and return its plaintext once."""
    user = require_editor_user(access)
    plaintext = generate_plaintext_token()
    with transaction() as conn:
        row = repository.insert_token(
            conn,
            project_id=access.project_id,
            issued_by_user_id=user.id,
            payload=payload,
            token_hash=token_hash(plaintext),
            token_prefix=token_prefix(plaintext),
        )
        auth_repository.log_action(
            conn,
            action="mcp_token_issue",
            user_id=user.id,
            email=user.email,
            session_id=None,
            ip_address=client_ip(request_meta),
            user_agent=user_agent(request_meta),
            details={"project_id": str(access.project_id), "token_id": str(row["id"]), "scopes": payload.scopes},
        )
    return McpTokenIssueResponse(token=plaintext, token_record=token_public(row))


def list_project_tokens(access: ProjectAccess) -> McpTokenListResponse:
    """List issued token metadata without exposing token hashes or plaintext."""
    require_editor_user(access)
    with connection() as conn:
        rows = repository.list_tokens_for_project(conn, access.project_id)
    return McpTokenListResponse(tokens=[token_public(row) for row in rows])


def revoke_project_token(token_id: UUID, access: ProjectAccess, request_meta: Request) -> McpTokenPublic:
    """Revoke a project-scoped token for all future MCP requests."""
    user = require_editor_user(access)
    with transaction() as conn:
        row = repository.revoke_token(conn, access.project_id, token_id)
        if row is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "mcp_token_not_found", "MCP token not found.")
        auth_repository.log_action(
            conn,
            action="mcp_token_revoke",
            user_id=user.id,
            email=user.email,
            session_id=None,
            ip_address=client_ip(request_meta),
            user_agent=user_agent(request_meta),
            details={"project_id": str(access.project_id), "token_id": str(token_id)},
        )
    return token_public(row)


def authenticate_plaintext_token(plaintext: str) -> McpTokenRecord | None:
    """Validate a high-entropy MCP bearer token and update its last-used timestamp."""
    with transaction() as conn:
        row = repository.get_token_by_hash(conn, token_hash(plaintext))
        if row is None or not repository.token_is_active(row, now_utc()):
            return None
        repository.touch_token(conn, row["id"])
    return token_record(row)


def get_active_token_by_id(token_id: UUID) -> McpTokenRecord | None:
    with connection() as conn:
        row = repository.get_token_by_id(conn, token_id)
    if row is None or not repository.token_is_active(row, now_utc()):
        return None
    return token_record(row)


def require_token_scope(token: McpTokenRecord, project_id: UUID, scope: McpScope) -> McpTokenRecord:
    """Apply the same project boundary for MCP tools as REST project routes."""
    if token.project_id != project_id:
        raise PermissionError("mcp_project_scope_mismatch")
    if scope not in token.scopes:
        raise PermissionError("mcp_scope_insufficient")
    return token


def project_access_for_token(token: McpTokenRecord, project_id: UUID, scope: McpScope) -> ProjectAccess:
    """Build the normal project-access object for a validated MCP token."""
    require_token_scope(token, project_id, scope)
    with connection() as conn:
        project_row = projects_repository.get_project_by_id(conn, project_id)
        user_row = auth_repository.get_user_by_id(conn, token.issued_by_user_id)
    if project_row is None:
        raise LookupError("project_not_found")
    if user_row is None:
        raise PermissionError("mcp_issuing_user_not_found")
    user_fields = UserPublic.model_fields.keys()
    return ProjectAccess(
        project_id=project_id,
        mode="view",
        user=UserPublic.model_validate({key: user_row[key] for key in user_fields}),
        project=ProjectSummary.model_validate(project_row),
    )


class PhNavigatorTokenVerifier(TokenVerifier):
    """Validate PH-Navigator project-scoped bearer tokens for FastMCP."""

    async def verify_token(self, token: str) -> AccessToken | None:
        record = await run_in_threadpool(authenticate_plaintext_token, token)
        if record is None:
            return None
        expires_at = int(record.expires_at.timestamp()) if record.expires_at is not None else None
        return AccessToken(
            token=record.token_prefix,
            client_id=str(record.id),
            scopes=list(record.scopes),
            expires_at=expires_at,
            resource=str(record.project_id),
        )
