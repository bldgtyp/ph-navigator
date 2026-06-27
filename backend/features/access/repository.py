"""Raw-SQL repository for per-user capability grants (``user_grants``)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection

from features.access.models import GrantScopeType

_GRANT_COLUMNS = "id, user_id, capability, scope_type, scope_id, granted_by, granted_at, revoked_at"


def insert_grant(
    conn: Connection[Any],
    *,
    user_id: UUID,
    capability: str,
    scope_type: GrantScopeType,
    scope_id: UUID | None,
    granted_by: UUID | None,
) -> dict[str, Any]:
    """Insert an active capability grant and return the stored row.

    The ``uq_user_grants_active`` partial unique index rejects a second active
    grant of the same (user, capability, scope); callers that re-grant should
    revoke first or treat the ``UniqueViolation`` as "already granted".
    """
    row = conn.execute(
        f"""
        INSERT INTO user_grants (user_id, capability, scope_type, scope_id, granted_by)
        VALUES (%(user_id)s, %(capability)s, %(scope_type)s, %(scope_id)s, %(granted_by)s)
        RETURNING {_GRANT_COLUMNS}
        """,
        {
            "user_id": user_id,
            "capability": capability,
            "scope_type": scope_type,
            "scope_id": scope_id,
            "granted_by": granted_by,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Grant insert did not return a row.")
    return row


def list_active_grants_for_user(conn: Connection[Any], user_id: UUID) -> list[dict[str, Any]]:
    """Return every non-revoked grant for a user (the resolver's grant input)."""
    rows = conn.execute(
        f"""
        SELECT {_GRANT_COLUMNS}
        FROM user_grants
        WHERE user_id = %(user_id)s
          AND revoked_at IS NULL
        ORDER BY granted_at
        """,
        {"user_id": user_id},
    ).fetchall()
    return list(rows)


def revoke_grant(
    conn: Connection[Any],
    *,
    user_id: UUID,
    capability: str,
    scope_type: GrantScopeType,
    scope_id: UUID | None,
) -> int:
    """Revoke the matching active grant; return the number of rows revoked (0 or 1).

    ``scope_id IS NOT DISTINCT FROM`` matches NULL-to-NULL for global grants,
    where ``=`` would not.
    """
    rows = conn.execute(
        """
        UPDATE user_grants
        SET revoked_at = now()
        WHERE user_id = %(user_id)s
          AND capability = %(capability)s
          AND scope_type = %(scope_type)s
          AND scope_id IS NOT DISTINCT FROM %(scope_id)s
          AND revoked_at IS NULL
        RETURNING id
        """,
        {
            "user_id": user_id,
            "capability": capability,
            "scope_type": scope_type,
            "scope_id": scope_id,
        },
    ).fetchall()
    return len(rows)
