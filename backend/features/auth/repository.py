"""Raw-SQL auth repository functions."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(conn: Connection[Any], email: str) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT id, email, display_name, password_hash,
               (deleted_at IS NULL) AS is_active, units_preference
        FROM users
        WHERE lower(email) = %(email)s
        """,
        {"email": normalize_email(email)},
    ).fetchone()


def get_user_by_email_for_update(conn: Connection[Any], email: str) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT id, email, display_name, password_hash,
               (deleted_at IS NULL) AS is_active, units_preference
        FROM users
        WHERE lower(email) = %(email)s
        FOR UPDATE
        """,
        {"email": normalize_email(email)},
    ).fetchone()


def get_user_by_id(conn: Connection[Any], user_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT id, email, display_name,
               (deleted_at IS NULL) AS is_active, units_preference
        FROM users
        WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    ).fetchone()


def upsert_user(conn: Connection[Any], email: str, display_name: str, password_hash: str) -> dict[str, Any]:
    row = conn.execute(
        """
        INSERT INTO users (email, display_name, password_hash)
        VALUES (%(email)s, %(display_name)s, %(password_hash)s)
        ON CONFLICT (lower(email))
        DO UPDATE
        SET display_name = EXCLUDED.display_name,
            password_hash = EXCLUDED.password_hash,
            deleted_at = NULL,
            updated_at = now()
        RETURNING id, email, display_name,
                  (deleted_at IS NULL) AS is_active, units_preference
        """,
        {
            "email": normalize_email(email),
            "display_name": display_name,
            "password_hash": password_hash,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("User upsert did not return a row.")
    return row


def update_user_units_preference(conn: Connection[Any], user_id: UUID, units_preference: str) -> dict[str, Any]:
    row = conn.execute(
        """
        UPDATE users
        SET units_preference = %(units_preference)s,
            updated_at = now()
        WHERE id = %(user_id)s
        RETURNING id, email, display_name,
                  (deleted_at IS NULL) AS is_active, units_preference
        """,
        {"user_id": user_id, "units_preference": units_preference},
    ).fetchone()
    if row is None:
        raise RuntimeError("User preference update did not return a row.")
    return row


def invalidate_active_sessions(
    conn: Connection[Any],
    user_id: UUID,
    reason: str,
    invalidated_at: datetime,
) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        UPDATE sessions
        SET invalidated_at = %(invalidated_at)s,
            invalidation_reason = %(reason)s
        WHERE user_id = %(user_id)s
          AND invalidated_at IS NULL
        RETURNING id, user_id
        """,
        {
            "user_id": user_id,
            "reason": reason,
            "invalidated_at": invalidated_at,
        },
    ).fetchall()
    return list(rows)


def insert_session(
    conn: Connection[Any],
    session_id: UUID,
    user_id: UUID,
    expires_at: datetime,
    ip_address: str | None,
    user_agent: str | None,
) -> dict[str, Any]:
    row = conn.execute(
        """
        INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent)
        VALUES (%(id)s, %(user_id)s, %(expires_at)s, %(ip_address)s, %(user_agent)s)
        RETURNING id, user_id, expires_at
        """,
        {
            "id": session_id,
            "user_id": user_id,
            "expires_at": expires_at,
            "ip_address": ip_address,
            "user_agent": user_agent,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Session insert did not return a row.")
    return row


def get_session_with_user(conn: Connection[Any], session_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT
            s.id                  AS session_id,
            s.user_id             AS session_user_id,
            s.expires_at          AS session_expires_at,
            s.last_seen_at        AS session_last_seen_at,
            s.invalidated_at      AS session_invalidated_at,
            s.invalidation_reason AS session_invalidation_reason,
            u.id                  AS user_id,
            u.email               AS user_email,
            u.display_name        AS user_display_name,
            (u.deleted_at IS NULL) AS user_is_active,
            u.units_preference    AS user_units_preference
        FROM sessions AS s
        JOIN users AS u ON u.id = s.user_id
        WHERE s.id = %(session_id)s
        """,
        {"session_id": session_id},
    ).fetchone()


def get_session_for_update(conn: Connection[Any], session_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT id, user_id, expires_at, invalidated_at, invalidation_reason
        FROM sessions
        WHERE id = %(session_id)s
        FOR UPDATE
        """,
        {"session_id": session_id},
    ).fetchone()


def touch_session(conn: Connection[Any], session_id: UUID, expires_at: datetime) -> None:
    conn.execute(
        """
        UPDATE sessions
        SET expires_at = %(expires_at)s,
            last_seen_at = now()
        WHERE id = %(session_id)s
        """,
        {"session_id": session_id, "expires_at": expires_at},
    )


def invalidate_session(
    conn: Connection[Any],
    session_id: UUID,
    reason: str,
    invalidated_at: datetime,
) -> None:
    conn.execute(
        """
        UPDATE sessions
        SET invalidated_at = COALESCE(invalidated_at, %(invalidated_at)s),
            invalidation_reason = COALESCE(invalidation_reason, %(reason)s)
        WHERE id = %(session_id)s
        """,
        {"session_id": session_id, "reason": reason, "invalidated_at": invalidated_at},
    )


def log_action(
    conn: Connection[Any],
    action: str,
    user_id: UUID | None,
    email: str | None,
    session_id: UUID | None,
    ip_address: str | None,
    user_agent: str | None,
    details: dict[str, Any] | None = None,
) -> None:
    conn.execute(
        """
        INSERT INTO user_action_log (
            action, user_id, email, session_id, ip_address, user_agent, details
        )
        VALUES (
            %(action)s, %(user_id)s, %(email)s, %(session_id)s,
            %(ip_address)s, %(user_agent)s, %(details)s
        )
        """,
        {
            "action": action,
            "user_id": user_id,
            "email": normalize_email(email) if email else None,
            "session_id": session_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "details": Jsonb(details or {}),
        },
    )
