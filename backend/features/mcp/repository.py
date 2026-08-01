"""Raw-SQL repository functions for project- and user-scoped MCP tokens."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from psycopg import Connection

from features.mcp.models import McpDeviceAuthorizationRequest, McpScope, McpTokenIssueRequest

DEVICE_AUTHORIZATION_COLUMNS = """
    id, user_code, label, scopes, status, approving_user_id, token_id,
    poll_interval_seconds, created_at, expires_at, last_polled_at,
    decided_at, redeemed_at
"""


def insert_token(
    conn: Connection[Any],
    project_id: UUID | None,
    issued_by_user_id: UUID,
    payload: McpTokenIssueRequest,
    token_hash: str,
    token_prefix: str,
) -> dict[str, Any]:
    row = conn.execute(
        """
        INSERT INTO mcp_tokens (
            project_id, issued_by_user_id, label, token_hash, token_prefix,
            scopes, expires_at
        )
        VALUES (
            %(project_id)s, %(issued_by_user_id)s, %(label)s, %(token_hash)s,
            %(token_prefix)s, %(scopes)s, %(expires_at)s
        )
        RETURNING id, project_id, issued_by_user_id, label, token_prefix,
                  scopes, created_at, last_used_at, expires_at, revoked_at
        """,
        {
            "project_id": project_id,
            "issued_by_user_id": issued_by_user_id,
            "label": payload.label,
            "token_hash": token_hash,
            "token_prefix": token_prefix,
            "scopes": payload.scopes,
            "expires_at": payload.expires_at,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("MCP token insert did not return a row.")
    return row


def list_tokens_for_project(conn: Connection[Any], project_id: UUID) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, project_id, issued_by_user_id, label, token_prefix,
               scopes, created_at, last_used_at, expires_at, revoked_at
        FROM mcp_tokens
        WHERE project_id = %(project_id)s
        ORDER BY created_at DESC
        """,
        {"project_id": project_id},
    ).fetchall()
    return list(rows)


def list_tokens_for_user(conn: Connection[Any], issued_by_user_id: UUID) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, project_id, issued_by_user_id, label, token_prefix,
               scopes, created_at, last_used_at, expires_at, revoked_at
        FROM mcp_tokens
        WHERE issued_by_user_id = %(issued_by_user_id)s
          AND project_id IS NULL
        ORDER BY created_at DESC
        """,
        {"issued_by_user_id": issued_by_user_id},
    ).fetchall()
    return list(rows)


def get_token_by_hash(conn: Connection[Any], token_hash: str) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT id, project_id, issued_by_user_id, label, token_prefix,
               scopes, created_at, last_used_at, expires_at, revoked_at
        FROM mcp_tokens
        WHERE token_hash = %(token_hash)s
        """,
        {"token_hash": token_hash},
    ).fetchone()


def get_token_by_id(conn: Connection[Any], token_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT id, project_id, issued_by_user_id, label, token_prefix,
               scopes, created_at, last_used_at, expires_at, revoked_at
        FROM mcp_tokens
        WHERE id = %(token_id)s
        """,
        {"token_id": token_id},
    ).fetchone()


def touch_token(conn: Connection[Any], token_id: UUID) -> None:
    conn.execute(
        """
        UPDATE mcp_tokens
        SET last_used_at = now()
        WHERE id = %(token_id)s
          AND (last_used_at IS NULL OR last_used_at < now() - interval '5 minutes')
        """,
        {"token_id": token_id},
    )


def revoke_token(conn: Connection[Any], project_id: UUID, token_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        """
        UPDATE mcp_tokens
        SET revoked_at = COALESCE(revoked_at, now())
        WHERE project_id = %(project_id)s
          AND id = %(token_id)s
        RETURNING id, project_id, issued_by_user_id, label, token_prefix,
                  scopes, created_at, last_used_at, expires_at, revoked_at
        """,
        {"project_id": project_id, "token_id": token_id},
    ).fetchone()


def revoke_user_token(
    conn: Connection[Any],
    issued_by_user_id: UUID,
    token_id: UUID,
) -> dict[str, Any] | None:
    return conn.execute(
        """
        UPDATE mcp_tokens
        SET revoked_at = COALESCE(revoked_at, now())
        WHERE issued_by_user_id = %(issued_by_user_id)s
          AND project_id IS NULL
          AND id = %(token_id)s
        RETURNING id, project_id, issued_by_user_id, label, token_prefix,
                  scopes, created_at, last_used_at, expires_at, revoked_at
        """,
        {"issued_by_user_id": issued_by_user_id, "token_id": token_id},
    ).fetchone()


def revoke_tokens_for_user(conn: Connection[Any], issued_by_user_id: UUID) -> list[UUID]:
    """Revoke every active token a user issued, across all projects.

    Used when a user is deactivated or completes a password reset: any MCP token
    attributable to them stops working immediately. Already-revoked tokens are
    left untouched. Returns the ids of the tokens revoked.
    """
    rows = conn.execute(
        """
        UPDATE mcp_tokens
        SET revoked_at = now()
        WHERE issued_by_user_id = %(user_id)s
          AND revoked_at IS NULL
        RETURNING id
        """,
        {"user_id": issued_by_user_id},
    ).fetchall()
    return [row["id"] for row in rows]


def insert_device_authorization(
    conn: Connection[Any],
    payload: McpDeviceAuthorizationRequest,
    *,
    device_code_hash: str,
    user_code: str,
    expires_at: datetime,
    poll_interval_seconds: int,
) -> dict[str, Any]:
    row = conn.execute(
        f"""
        INSERT INTO mcp_device_authorizations (
            device_code_hash, user_code, label, scopes, expires_at,
            poll_interval_seconds
        )
        VALUES (
            %(device_code_hash)s, %(user_code)s, %(label)s, %(scopes)s,
            %(expires_at)s, %(poll_interval_seconds)s
        )
        RETURNING {DEVICE_AUTHORIZATION_COLUMNS}
        """,
        {
            "device_code_hash": device_code_hash,
            "user_code": user_code,
            "label": payload.label,
            "scopes": payload.scopes,
            "expires_at": expires_at,
            "poll_interval_seconds": poll_interval_seconds,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Device authorization insert did not return a row.")
    return row


def expire_stale_device_authorizations(conn: Connection[Any], now: datetime) -> int:
    result = conn.execute(
        """
        UPDATE mcp_device_authorizations
        SET status = 'expired'
        WHERE status IN ('pending', 'approved')
          AND expires_at <= %(now)s
        """,
        {"now": now},
    )
    return result.rowcount


def purge_terminal_device_authorizations(conn: Connection[Any], older_than: datetime) -> int:
    result = conn.execute(
        """
        DELETE FROM mcp_device_authorizations
        WHERE status IN ('denied', 'expired', 'redeemed')
          AND created_at < %(older_than)s
        """,
        {"older_than": older_than},
    )
    return result.rowcount


def expire_device_authorization(
    conn: Connection[Any],
    authorization_id: UUID,
    *,
    now: datetime,
) -> dict[str, Any] | None:
    return conn.execute(
        f"""
        UPDATE mcp_device_authorizations
        SET status = 'expired'
        WHERE id = %(authorization_id)s
          AND status IN ('pending', 'approved')
          AND expires_at <= %(now)s
        RETURNING {DEVICE_AUTHORIZATION_COLUMNS}
        """,
        {"authorization_id": authorization_id, "now": now},
    ).fetchone()


def get_device_authorization_by_user_code(
    conn: Connection[Any],
    user_code: str,
) -> dict[str, Any] | None:
    return conn.execute(
        f"""
        SELECT {DEVICE_AUTHORIZATION_COLUMNS}
        FROM mcp_device_authorizations
        WHERE user_code = %(user_code)s
        """,
        {"user_code": user_code},
    ).fetchone()


def decide_device_authorization(
    conn: Connection[Any],
    user_code: str,
    *,
    approving_user_id: UUID,
    target_status: Literal["approved", "denied"],
    now: datetime,
) -> dict[str, Any] | None:
    return conn.execute(
        f"""
        UPDATE mcp_device_authorizations
        SET status = %(status)s,
            approving_user_id = %(approving_user_id)s,
            decided_at = %(now)s
        WHERE user_code = %(user_code)s
          AND status = 'pending'
          AND expires_at > %(now)s
        RETURNING {DEVICE_AUTHORIZATION_COLUMNS}
        """,
        {
            "status": target_status,
            "approving_user_id": approving_user_id,
            "user_code": user_code,
            "now": now,
        },
    ).fetchone()


def deny_approved_device_authorization(
    conn: Connection[Any],
    authorization_id: UUID,
    *,
    now: datetime,
) -> None:
    conn.execute(
        """
        UPDATE mcp_device_authorizations
        SET status = 'denied', decided_at = COALESCE(decided_at, %(now)s)
        WHERE id = %(authorization_id)s
          AND status = 'approved'
        """,
        {"authorization_id": authorization_id, "now": now},
    )


def get_device_authorization_for_poll(
    conn: Connection[Any],
    device_code_hash: str,
) -> dict[str, Any] | None:
    return conn.execute(
        f"""
        SELECT {DEVICE_AUTHORIZATION_COLUMNS}
        FROM mcp_device_authorizations
        WHERE device_code_hash = %(device_code_hash)s
        FOR UPDATE
        """,
        {"device_code_hash": device_code_hash},
    ).fetchone()


def record_device_poll(
    conn: Connection[Any],
    authorization_id: UUID,
    *,
    now: datetime,
    poll_interval_seconds: int,
) -> None:
    conn.execute(
        """
        UPDATE mcp_device_authorizations
        SET last_polled_at = %(now)s,
            poll_interval_seconds = %(poll_interval_seconds)s
        WHERE id = %(authorization_id)s
        """,
        {
            "authorization_id": authorization_id,
            "now": now,
            "poll_interval_seconds": poll_interval_seconds,
        },
    )


def redeem_device_authorization(
    conn: Connection[Any],
    authorization_id: UUID,
    *,
    token_id: UUID,
    now: datetime,
) -> bool:
    result = conn.execute(
        """
        UPDATE mcp_device_authorizations
        SET status = 'redeemed', token_id = %(token_id)s,
            redeemed_at = %(now)s, last_polled_at = %(now)s
        WHERE id = %(authorization_id)s
          AND status = 'approved'
        """,
        {"authorization_id": authorization_id, "token_id": token_id, "now": now},
    )
    return result.rowcount == 1


def token_has_scope(token: dict[str, Any], scope: McpScope) -> bool:
    scopes = token.get("scopes") or []
    return scope in scopes


def token_is_active(token: dict[str, Any], now: datetime) -> bool:
    expires_at = token.get("expires_at")
    return token.get("revoked_at") is None and (expires_at is None or expires_at > now)
