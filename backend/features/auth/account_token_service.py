"""Issuing logic for single-use invite / password-reset account tokens.

Pairs with `features.auth.account_tokens` (pure crypto + link building) and the
account-token functions in `features.auth.repository` (storage). Issuing a token
is *revoke-and-replace*: any currently-active token of the same type is revoked
first so only the newest link works, then a fresh token is minted and its keyed
hash stored. The raw link is returned to the immediate caller only — it is never
persisted, re-displayed, audited, or logged.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from psycopg import Connection

from config import settings
from features.auth import repository
from features.auth.account_tokens import (
    AccountTokenType,
    build_account_link,
    generate_raw_token,
    hash_token,
)


def token_expires_at(token_type: AccountTokenType, now: datetime) -> datetime:
    """Return the expiry for a freshly issued token of ``token_type``."""
    if token_type == "invite":
        return now + timedelta(hours=settings.account_invite_token_ttl_hours)
    return now + timedelta(minutes=settings.account_reset_token_ttl_minutes)


def issue_account_token(
    conn: Connection[Any],
    *,
    user_id: UUID,
    token_type: AccountTokenType,
    created_by: UUID | None,
    now: datetime,
    request_ip: str | None = None,
    request_user_agent: str | None = None,
) -> tuple[dict[str, Any], str]:
    """Revoke active tokens of this type, mint a new one, return ``(row, raw_link)``.

    Runs inside the caller's transaction so revoke + insert are atomic. The
    returned ``raw_link`` is the only place the raw token ever appears.
    """
    repository.revoke_active_account_tokens(conn, user_id, token_type)
    raw_token = generate_raw_token()
    row = repository.insert_account_token(
        conn,
        user_id=user_id,
        token_type=token_type,
        token_hash=hash_token(raw_token),
        expires_at=token_expires_at(token_type, now),
        created_by=created_by,
        request_ip=request_ip,
        request_user_agent=request_user_agent,
    )
    return row, build_account_link(token_type, raw_token)
