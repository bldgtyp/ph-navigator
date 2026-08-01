"""Workflow rules for MCP tokens and read-only tool calls."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Any, cast
from uuid import UUID

from fastapi import Request
from mcp.server.auth.provider import AccessToken, TokenVerifier
from psycopg import Connection
from psycopg.errors import UniqueViolation
from starlette import status
from starlette.concurrency import run_in_threadpool

from config import settings
from database import connection, transaction
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import client_ip, now_utc, user_agent
from features.mcp import repository
from features.mcp.models import (
    McpDeviceAuthorizationApprovedPoll,
    McpDeviceAuthorizationDecision,
    McpDeviceAuthorizationDeniedPoll,
    McpDeviceAuthorizationExpiredPoll,
    McpDeviceAuthorizationPendingPoll,
    McpDeviceAuthorizationPollResponse,
    McpDeviceAuthorizationPublic,
    McpDeviceAuthorizationRequest,
    McpDeviceAuthorizationSlowDownPoll,
    McpDeviceAuthorizationStart,
    McpScope,
    McpTokenIssueRequest,
    McpTokenIssueResponse,
    McpTokenListResponse,
    McpTokenPublic,
    McpTokenRecord,
)
from features.projects import repository as projects_repository
from features.projects.access import ProjectAccess, project_access_for_user, require_editor_user
from features.projects.models import ProjectSummary
from features.shared.errors import api_error

TOKEN_PREFIX_LENGTH = 16
USER_TOKEN_LIFETIME = timedelta(days=365)
DEVICE_CODE_LIFETIME = timedelta(minutes=10)
DEVICE_POLL_INTERVAL_SECONDS = 5
DEVICE_POLL_INTERVAL_MAX_SECONDS = 30
DEVICE_AUTHORIZATION_RETENTION = timedelta(days=30)
USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
DEVICE_CODE_UNIQUE_CONSTRAINT = "uq_mcp_device_authorizations_device_code_hash"
USER_CODE_UNIQUE_CONSTRAINT = "uq_mcp_device_authorizations_user_code"


class McpProjectDeletedError(LookupError):
    """Raised when a valid project-scoped token points at a soft-deleted project."""

    def __init__(self, project: dict[str, object]) -> None:
        super().__init__("project_deleted")
        self.project = project


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


def device_authorization_public(row: dict[str, object]) -> McpDeviceAuthorizationPublic:
    public_fields = McpDeviceAuthorizationPublic.model_fields.keys()
    return McpDeviceAuthorizationPublic.model_validate({key: row[key] for key in public_fields})


def generate_device_code() -> str:
    return f"phn_device_{secrets.token_urlsafe(32)}"


def generate_user_code() -> str:
    compact = "".join(secrets.choice(USER_CODE_ALPHABET) for _ in range(8))
    return f"{compact[:4]}-{compact[4:]}"


def normalize_user_code(user_code: str) -> str:
    compact = "".join(character for character in user_code.upper() if character.isalnum())
    if len(compact) != 8:
        return user_code.strip().upper()
    return f"{compact[:4]}-{compact[4:]}"


def _expire_device_row_if_needed(
    conn: Connection[Any],
    row: dict[str, object],
    now: datetime,
) -> dict[str, object]:
    expires_at = row["expires_at"]
    authorization_id = row["id"]
    if (
        row["status"] in {"pending", "approved"}
        and isinstance(expires_at, datetime)
        and expires_at <= now
        and isinstance(authorization_id, UUID)
    ):
        return repository.expire_device_authorization(conn, authorization_id, now=now) or row
    return row


def _issue_user_token_in_transaction(
    conn: Connection[Any],
    payload: McpTokenIssueRequest,
    *,
    user_id: UUID,
    email: str,
    request_meta: Request,
    audit_details: dict[str, object] | None = None,
) -> McpTokenIssueResponse:
    plaintext = generate_plaintext_token()
    row = repository.insert_token(
        conn,
        project_id=None,
        issued_by_user_id=user_id,
        payload=payload,
        token_hash=token_hash(plaintext),
        token_prefix=token_prefix(plaintext),
    )
    details: dict[str, object] = {"token_id": str(row["id"]), "scopes": payload.scopes}
    details.update(audit_details or {})
    auth_repository.log_action(
        conn,
        action="agent_token_issue",
        user_id=user_id,
        email=email,
        session_id=None,
        ip_address=client_ip(request_meta),
        user_agent=user_agent(request_meta),
        details=details,
    )
    return McpTokenIssueResponse(token=plaintext, token_record=token_public(row))


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


def issue_user_token(
    payload: McpTokenIssueRequest,
    user: UserPublic,
    request_meta: Request,
) -> McpTokenIssueResponse:
    """Create a user-scoped bearer token with the fixed one-year lifetime."""
    expires_at = payload.expires_at or now_utc() + USER_TOKEN_LIFETIME
    normalized = payload.model_copy(update={"expires_at": expires_at})
    with transaction() as conn:
        return _issue_user_token_in_transaction(
            conn,
            normalized,
            user_id=user.id,
            email=str(user.email),
            request_meta=request_meta,
        )


def start_device_authorization(payload: McpDeviceAuthorizationRequest) -> McpDeviceAuthorizationStart:
    """Create a short-lived device grant and return its plaintext code once."""
    expires_at = now_utc() + DEVICE_CODE_LIFETIME
    for _attempt in range(5):
        device_code = generate_device_code()
        user_code = generate_user_code()
        try:
            with transaction() as conn:
                repository.expire_stale_device_authorizations(conn, now_utc())
                repository.purge_terminal_device_authorizations(
                    conn,
                    now_utc() - DEVICE_AUTHORIZATION_RETENTION,
                )
                repository.insert_device_authorization(
                    conn,
                    payload,
                    device_code_hash=token_hash(device_code),
                    user_code=user_code,
                    expires_at=expires_at,
                    poll_interval_seconds=DEVICE_POLL_INTERVAL_SECONDS,
                )
        except UniqueViolation as exc:
            if exc.diag.constraint_name not in {DEVICE_CODE_UNIQUE_CONSTRAINT, USER_CODE_UNIQUE_CONSTRAINT}:
                raise
            continue
        verification_url = f"{settings.frontend_base_url.rstrip('/')}/approve-agent?code={user_code}"
        return McpDeviceAuthorizationStart(
            device_code=device_code,
            user_code=user_code,
            verification_url=verification_url,
            interval=DEVICE_POLL_INTERVAL_SECONDS,
            expires_in=int(DEVICE_CODE_LIFETIME.total_seconds()),
        )
    raise RuntimeError("Could not allocate a unique device authorization code.")


def get_device_authorization(user_code: str) -> McpDeviceAuthorizationPublic:
    """Return one browser-visible device grant without exposing its device code."""
    now = now_utc()
    with transaction() as conn:
        row = repository.get_device_authorization_by_user_code(conn, normalize_user_code(user_code))
        if row is not None:
            row = _expire_device_row_if_needed(conn, row, now)
    if row is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "device_authorization_not_found", "Agent request not found.")
    return device_authorization_public(row)


def decide_device_authorization(
    user_code: str,
    payload: McpDeviceAuthorizationDecision,
    user: UserPublic,
    request_meta: Request,
) -> McpDeviceAuthorizationPublic:
    """Approve or deny a pending device grant as the signed-in user."""
    now = now_utc()
    normalized_code = normalize_user_code(user_code)
    target_status = "approved" if payload.decision == "approve" else "denied"
    with transaction() as conn:
        row = repository.decide_device_authorization(
            conn,
            normalized_code,
            approving_user_id=user.id,
            target_status=target_status,
            now=now,
        )
        if row is None:
            existing = repository.get_device_authorization_by_user_code(conn, normalized_code)
            if existing is None:
                raise api_error(
                    status.HTTP_404_NOT_FOUND,
                    "device_authorization_not_found",
                    "Agent request not found.",
                )
            existing = _expire_device_row_if_needed(conn, existing, now)
            raise api_error(
                status.HTTP_409_CONFLICT,
                "device_authorization_not_pending",
                "Agent request is no longer pending.",
                {"status": existing["status"]},
            )
        auth_repository.log_action(
            conn,
            action=f"agent_device_{payload.decision}",
            user_id=user.id,
            email=user.email,
            session_id=None,
            ip_address=client_ip(request_meta),
            user_agent=user_agent(request_meta),
            details={"user_code": normalized_code, "label": row["label"], "scopes": row["scopes"]},
        )
    return device_authorization_public(row)


def poll_device_authorization(
    device_code: str,
    request_meta: Request,
) -> McpDeviceAuthorizationPollResponse:
    """Poll one device grant and redeem an approved grant exactly once."""
    now = now_utc()
    with transaction() as conn:
        row = repository.get_device_authorization_for_poll(conn, token_hash(device_code))
        if row is None:
            return McpDeviceAuthorizationExpiredPoll(status="expired")
        row = _expire_device_row_if_needed(conn, row, now)
        if row["status"] in {"expired", "redeemed"}:
            return McpDeviceAuthorizationExpiredPoll(status="expired")
        if row["status"] == "denied":
            return McpDeviceAuthorizationDeniedPoll(status="denied")

        interval_value = row["poll_interval_seconds"]
        authorization_id = row["id"]
        last_polled_at = row["last_polled_at"]
        if not isinstance(interval_value, int) or not isinstance(authorization_id, UUID):
            raise RuntimeError("Device authorization poll state is invalid.")
        if last_polled_at is not None and not isinstance(last_polled_at, datetime):
            raise RuntimeError("Device authorization poll timestamp is invalid.")
        interval = interval_value
        if last_polled_at is not None and last_polled_at + timedelta(seconds=interval) > now:
            interval = min(interval + 5, DEVICE_POLL_INTERVAL_MAX_SECONDS)
            repository.record_device_poll(
                conn,
                authorization_id,
                now=now,
                poll_interval_seconds=interval,
            )
            return McpDeviceAuthorizationSlowDownPoll(status="slow_down", interval=interval)

        if row["status"] == "pending":
            repository.record_device_poll(
                conn,
                authorization_id,
                now=now,
                poll_interval_seconds=interval,
            )
            return McpDeviceAuthorizationPendingPoll(status="authorization_pending", interval=interval)

        issued = _redeem_approved_device_authorization(conn, row, now, request_meta)
        if issued is None:
            return McpDeviceAuthorizationDeniedPoll(status="denied")
        return McpDeviceAuthorizationApprovedPoll(
            status="approved",
            token=issued.token,
            token_record=issued.token_record,
        )


def _redeem_approved_device_authorization(
    conn: Connection[Any],
    row: dict[str, object],
    now: datetime,
    request_meta: Request,
) -> McpTokenIssueResponse | None:
    approving_user_id = row["approving_user_id"]
    if not isinstance(approving_user_id, UUID):
        raise RuntimeError("Approved device authorization has no approving user.")
    user_row = auth_repository.get_user_by_id(conn, approving_user_id)
    if user_row is None or not user_row["is_active"]:
        authorization_id = row["id"]
        if isinstance(authorization_id, UUID):
            repository.deny_approved_device_authorization(conn, authorization_id, now=now)
        return None

    payload = McpTokenIssueRequest(
        label=str(row["label"]),
        scopes=cast(list[McpScope], row["scopes"]),
        expires_at=now + USER_TOKEN_LIFETIME,
    )
    authorization_id = row["id"]
    if not isinstance(authorization_id, UUID):
        raise RuntimeError("Device authorization has an invalid id.")
    issued = _issue_user_token_in_transaction(
        conn,
        payload,
        user_id=approving_user_id,
        email=str(user_row["email"]),
        request_meta=request_meta,
        audit_details={"via": "device"},
    )
    if not repository.redeem_device_authorization(
        conn,
        authorization_id,
        token_id=issued.token_record.id,
        now=now,
    ):
        raise RuntimeError("Approved device authorization could not be redeemed.")
    return issued


def list_project_tokens(access: ProjectAccess) -> McpTokenListResponse:
    """List issued token metadata without exposing token hashes or plaintext."""
    require_editor_user(access)
    with connection() as conn:
        rows = repository.list_tokens_for_project(conn, access.project_id)
    return McpTokenListResponse(tokens=[token_public(row) for row in rows])


def list_user_tokens(user: UserPublic) -> McpTokenListResponse:
    """List the signed-in user's account token metadata."""
    with connection() as conn:
        rows = repository.list_tokens_for_user(conn, user.id)
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


def revoke_user_token(
    token_id: UUID,
    user: UserPublic,
    request_meta: Request,
) -> McpTokenPublic:
    """Revoke one account token owned by the signed-in user."""
    with transaction() as conn:
        row = repository.revoke_user_token(conn, user.id, token_id)
        if row is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "agent_token_not_found", "Agent token not found.")
        auth_repository.log_action(
            conn,
            action="agent_token_revoke",
            user_id=user.id,
            email=user.email,
            session_id=None,
            ip_address=client_ip(request_meta),
            user_agent=user_agent(request_meta),
            details={"token_id": str(token_id)},
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


def require_token_scope(
    token: McpTokenRecord,
    project_id: UUID | None,
    scope: McpScope,
) -> McpTokenRecord:
    """Apply the same project boundary for MCP tools as REST project routes."""
    if token.project_id is not None and token.project_id != project_id:
        raise PermissionError("mcp_project_scope_mismatch")
    if scope not in token.scopes:
        raise PermissionError("mcp_scope_insufficient")
    return token


def project_access_for_token(token: McpTokenRecord, project_id: UUID, scope: McpScope) -> ProjectAccess:
    """Build the normal project-access object for a validated MCP token."""
    require_token_scope(token, project_id, scope)
    with connection() as conn:
        project_row = projects_repository.get_project_by_id_including_deleted(conn, project_id)
        user_row = auth_repository.get_user_by_id(conn, token.issued_by_user_id)
    if project_row is None:
        raise LookupError("project_not_found")
    if project_row["deleted_at"] is not None:
        raise McpProjectDeletedError(project_row)
    if user_row is None:
        raise PermissionError("mcp_issuing_user_not_found")
    # The token acts as its issuer: resolve the issuer's capabilities the same
    # way the request seam does. (Token-scope intersection is Phase 5; today the
    # project/scope boundary is enforced by require_token_scope above.)
    user = UserPublic.model_validate({key: user_row[key] for key in UserPublic.model_fields})
    project = ProjectSummary.model_validate(
        {key: project_row[key] for key in ProjectSummary.model_fields if key in project_row}
    )
    return project_access_for_user(user, project, "view")


class PhNavigatorTokenVerifier(TokenVerifier):
    """Validate PH-Navigator project- or user-scoped bearer tokens for FastMCP."""

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
            resource=str(record.project_id or record.issued_by_user_id),
        )
