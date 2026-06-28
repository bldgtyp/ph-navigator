"""Raw-SQL repository functions for project-scoped MCP tokens."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from psycopg import Connection

from features.mcp.models import McpScope, McpTokenIssueRequest


def insert_token(
    conn: Connection[Any],
    project_id: UUID,
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


def token_has_scope(token: dict[str, Any], scope: McpScope) -> bool:
    scopes = token.get("scopes") or []
    return scope in scopes


def token_is_active(token: dict[str, Any], now: datetime) -> bool:
    expires_at = token.get("expires_at")
    return token.get("revoked_at") is None and (expires_at is None or expires_at > now)
