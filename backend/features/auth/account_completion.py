"""Public invite / password-reset completion.

The user presents the raw token from their one-time link; the API receives it in
a JSON body (never a query string). Completion is one transaction: validate the
token under a row lock, set the new password through the existing Argon2id path,
consume the token, then revoke every other credential the account holds —
remaining account tokens, active sessions, and attributable MCP tokens — so a
stale link or hijacked session cannot survive a reset. All failure modes return
the same generic error so the endpoint does not reveal why a link is unusable.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from psycopg import Connection
from starlette import status

from database import transaction
from features.auth import repository
from features.auth.account_tokens import AccountTokenType, hash_token
from features.auth.models import UserPublic
from features.auth.passwords import hash_password
from features.auth.service import now_utc, public_user
from features.mcp import repository as mcp_repository
from features.shared.errors import api_error

# Self-service completion audit actions (the admin-initiated counterparts live in
# features.admin.audit).
PASSWORD_RESET_COMPLETED = "password_reset_completed"
ACCOUNT_INVITE_COMPLETED = "account_invite_completed"

_GENERIC_TOKEN_ERROR = "This link is invalid or has expired."


def _redeem_token(
    conn: Connection[Any],
    *,
    raw_token: str,
    expected_type: AccountTokenType,
    now: datetime,
) -> UUID:
    """Validate + consume a token under a row lock; return its user id.

    Rejects an unknown, wrong-type, already-consumed, revoked, or expired token
    with one indistinguishable error.
    """
    token = repository.get_account_token_by_hash_for_update(conn, hash_token(raw_token))
    if (
        token is None
        or token["token_type"] != expected_type
        or token["consumed_at"] is not None
        or token["revoked_at"] is not None
        or token["expires_at"] <= now
    ):
        raise api_error(status.HTTP_400_BAD_REQUEST, "invalid_token", _GENERIC_TOKEN_ERROR)
    repository.consume_account_token(conn, token["id"])
    return token["user_id"]


def _complete(
    *,
    raw_token: str,
    password: str,
    expected_type: AccountTokenType,
    completed_action: str,
    ip_address: str | None,
    user_agent: str | None,
) -> UserPublic:
    now = now_utc()
    with transaction() as conn:
        user_id = _redeem_token(conn, raw_token=raw_token, expected_type=expected_type, now=now)

        updated = repository.set_user_password(conn, user_id, hash_password(password))
        # Invalidate any other outstanding link, every active session, and every
        # MCP token attributable to the user.
        repository.revoke_active_account_tokens(conn, user_id)
        repository.invalidate_active_sessions(conn, user_id=user_id, reason=completed_action, invalidated_at=now)
        mcp_repository.revoke_tokens_for_user(conn, user_id)

        email = str(updated["email"])
        repository.log_action(
            conn,
            action=completed_action,
            user_id=user_id,
            email=email,
            session_id=None,
            ip_address=ip_address,
            user_agent=user_agent,
            target_user_id=user_id,
            target_email=email,
        )
        return public_user(updated)


def complete_invite(*, raw_token: str, password: str, ip_address: str | None, user_agent: str | None) -> UserPublic:
    """Set the initial password for an invited user and consume the invite token."""
    return _complete(
        raw_token=raw_token,
        password=password,
        expected_type="invite",
        completed_action=ACCOUNT_INVITE_COMPLETED,
        ip_address=ip_address,
        user_agent=user_agent,
    )


def complete_reset(*, raw_token: str, password: str, ip_address: str | None, user_agent: str | None) -> UserPublic:
    """Set a new password from an admin-issued reset token and consume it."""
    return _complete(
        raw_token=raw_token,
        password=password,
        expected_type="password_reset",
        completed_action=PASSWORD_RESET_COMPLETED,
        ip_address=ip_address,
        user_agent=user_agent,
    )
