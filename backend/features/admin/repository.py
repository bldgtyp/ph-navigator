"""Raw-SQL reads for the admin user-management dashboard + last-admin guard.

Writes reuse the auth/access repositories; this module only adds the read shapes
specific to the admin surface (the user list with derived status/role and recent
action, the transactional last-admin lock, and per-user audit history).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection

from features.access.capabilities import ADMIN_USERS_MANAGE

# Shared SELECT body for the dashboard row shape. The subqueries surface who
# currently holds the Admin preset, who has an active (unconsumed, unrevoked,
# unexpired) invite, and the most recent audit-action timestamp per target user.
# Status is derived in the service from deleted_at + password_set_at.
_USER_ROW_SELECT = """
SELECT
    u.id,
    u.email,
    u.display_name,
    u.is_staff,
    u.created_at,
    u.deleted_at,
    u.password_set_at,
    (admin.user_id IS NOT NULL) AS is_admin,
    COALESCE(invite.has_active_invite, false) AS has_active_invite,
    last_action.last_action_at
FROM users AS u
LEFT JOIN (
    SELECT DISTINCT user_id
    FROM user_grants
    WHERE capability = %(admin_cap)s AND scope_type = 'global' AND revoked_at IS NULL
) AS admin ON admin.user_id = u.id
LEFT JOIN (
    SELECT user_id, true AS has_active_invite
    FROM account_tokens
    WHERE token_type = 'invite'
      AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now()
    GROUP BY user_id
) AS invite ON invite.user_id = u.id
LEFT JOIN (
    SELECT target_user_id, max(created_at) AS last_action_at
    FROM user_action_log
    WHERE target_user_id IS NOT NULL
    GROUP BY target_user_id
) AS last_action ON last_action.target_user_id = u.id
"""


def list_user_rows(conn: Connection[Any]) -> list[dict[str, Any]]:
    """Return every user with the fields the dashboard needs (status derived in the service)."""
    rows = conn.execute(_USER_ROW_SELECT + "ORDER BY u.created_at", {"admin_cap": ADMIN_USERS_MANAGE}).fetchall()
    return list(rows)


def get_user_row(conn: Connection[Any], user_id: UUID) -> dict[str, Any] | None:
    """Return the dashboard row for a single user (for a mutation response)."""
    return conn.execute(
        _USER_ROW_SELECT + "WHERE u.id = %(user_id)s",
        {"admin_cap": ADMIN_USERS_MANAGE, "user_id": user_id},
    ).fetchone()


def lock_active_admin_user_ids(conn: Connection[Any]) -> set[UUID]:
    """Return the set of *active* admins, locking the grant rows ``FOR UPDATE``.

    Locking serializes concurrent demotions/deactivations so two transactions
    cannot each remove a different admin and race the account into a zero-admin
    state. Only counts grants whose user is not soft-deleted.
    """
    rows = conn.execute(
        """
        SELECT g.user_id
        FROM user_grants AS g
        JOIN users AS u ON u.id = g.user_id
        WHERE g.capability = %(admin_cap)s
          AND g.scope_type = 'global'
          AND g.revoked_at IS NULL
          AND u.deleted_at IS NULL
        FOR UPDATE OF g
        """,
        {"admin_cap": ADMIN_USERS_MANAGE},
    ).fetchall()
    return {row["user_id"] for row in rows}


def list_user_audit(conn: Connection[Any], target_user_id: UUID, limit: int) -> list[dict[str, Any]]:
    """Return the most recent audit rows targeting ``target_user_id`` (newest first)."""
    rows = conn.execute(
        """
        SELECT id, action, user_id AS actor_user_id, email AS actor_email,
               target_email, ip_address, created_at, details
        FROM user_action_log
        WHERE target_user_id = %(target_user_id)s
        ORDER BY created_at DESC, id DESC
        LIMIT %(limit)s
        """,
        {"target_user_id": target_user_id, "limit": limit},
    ).fetchall()
    return list(rows)
