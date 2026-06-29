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
        SELECT id, email, display_name, password_hash, password_set_at,
               (deleted_at IS NULL) AS is_active, units_preference
        FROM users
        WHERE lower(email) = %(email)s
        """,
        {"email": normalize_email(email)},
    ).fetchone()


def get_user_by_email_for_update(conn: Connection[Any], email: str) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT id, email, display_name, password_hash, password_set_at,
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


def get_user_is_staff(conn: Connection[Any], user_id: UUID) -> bool:
    """Return the bldgtyp cross-tenant ``is_staff`` flag for a user."""
    row = conn.execute(
        "SELECT is_staff FROM users WHERE id = %(user_id)s",
        {"user_id": user_id},
    ).fetchone()
    return bool(row and row["is_staff"])


def upsert_user(conn: Connection[Any], email: str, display_name: str, password_hash: str) -> dict[str, Any]:
    row = conn.execute(
        """
        INSERT INTO users (email, display_name, password_hash, password_set_at)
        VALUES (%(email)s, %(display_name)s, %(password_hash)s, now())
        ON CONFLICT (lower(email))
        DO UPDATE
        SET display_name = EXCLUDED.display_name,
            password_hash = EXCLUDED.password_hash,
            password_set_at = now(),
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


def upsert_invited_user(conn: Connection[Any], email: str, display_name: str) -> dict[str, Any]:
    """Create (or reactivate) a user in the *invited* state — no usable password.

    Used by the invite flow and the first-admin bootstrap. An existing row keeps
    its ``password_hash``/``password_set_at`` (re-inviting an active user must not
    wipe their credential); a soft-deleted row is reactivated by clearing
    ``deleted_at``. The pending/invited state is "no password set" — see
    ``can_authenticate`` in `features.auth.service`.
    """
    row = conn.execute(
        """
        INSERT INTO users (email, display_name, password_hash, password_set_at)
        VALUES (%(email)s, %(display_name)s, NULL, NULL)
        ON CONFLICT (lower(email))
        DO UPDATE
        SET display_name = EXCLUDED.display_name,
            deleted_at = NULL,
            updated_at = now()
        RETURNING id, email, display_name, password_hash, password_set_at,
                  (deleted_at IS NULL) AS is_active, units_preference
        """,
        {"email": normalize_email(email), "display_name": display_name},
    ).fetchone()
    if row is None:
        raise RuntimeError("Invited-user upsert did not return a row.")
    return row


def get_user_account_for_update(conn: Connection[Any], user_id: UUID) -> dict[str, Any] | None:
    """Lock and return a user's account row for an admin lifecycle mutation."""
    return conn.execute(
        """
        SELECT id, email, display_name, password_hash, password_set_at,
               (deleted_at IS NULL) AS is_active, units_preference
        FROM users
        WHERE id = %(user_id)s
        FOR UPDATE
        """,
        {"user_id": user_id},
    ).fetchone()


def set_user_active(conn: Connection[Any], user_id: UUID, *, active: bool) -> dict[str, Any]:
    """Soft-deactivate (``active=False`` -> set ``deleted_at``) or reactivate a user."""
    row = conn.execute(
        """
        UPDATE users
        SET deleted_at = CASE WHEN %(active)s THEN NULL ELSE now() END,
            updated_at = now()
        WHERE id = %(user_id)s
        RETURNING id, email, display_name,
                  (deleted_at IS NULL) AS is_active, units_preference
        """,
        {"user_id": user_id, "active": active},
    ).fetchone()
    if row is None:
        raise RuntimeError("User active-state update did not return a row.")
    return row


def set_user_display_name(conn: Connection[Any], user_id: UUID, display_name: str) -> dict[str, Any]:
    """Set a user's display name and return the public account row."""
    row = conn.execute(
        """
        UPDATE users
        SET display_name = %(display_name)s,
            updated_at = now()
        WHERE id = %(user_id)s
        RETURNING id, email, display_name,
                  (deleted_at IS NULL) AS is_active, units_preference
        """,
        {"user_id": user_id, "display_name": display_name},
    ).fetchone()
    if row is None:
        raise RuntimeError("User display-name update did not return a row.")
    return row


def set_user_email(conn: Connection[Any], user_id: UUID, email: str) -> dict[str, Any]:
    """Set a user's normalized email and return the public account row."""
    row = conn.execute(
        """
        UPDATE users
        SET email = %(email)s,
            updated_at = now()
        WHERE id = %(user_id)s
        RETURNING id, email, display_name,
                  (deleted_at IS NULL) AS is_active, units_preference
        """,
        {"user_id": user_id, "email": normalize_email(email)},
    ).fetchone()
    if row is None:
        raise RuntimeError("User email update did not return a row.")
    return row


def set_user_password(conn: Connection[Any], user_id: UUID, password_hash: str) -> dict[str, Any]:
    """Set a user's password hash and stamp ``password_set_at`` to now."""
    row = conn.execute(
        """
        UPDATE users
        SET password_hash = %(password_hash)s,
            password_set_at = now(),
            updated_at = now()
        WHERE id = %(user_id)s
        RETURNING id, email, display_name,
                  (deleted_at IS NULL) AS is_active, units_preference
        """,
        {"user_id": user_id, "password_hash": password_hash},
    ).fetchone()
    if row is None:
        raise RuntimeError("User password update did not return a row.")
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


def set_user_is_staff(conn: Connection[Any], user_id: UUID, is_staff: bool) -> dict[str, Any]:
    """Set the bldgtyp cross-tenant ``is_staff`` flag and return the user row."""
    row = conn.execute(
        """
        UPDATE users
        SET is_staff = %(is_staff)s,
            updated_at = now()
        WHERE id = %(user_id)s
        RETURNING id, email, display_name, is_staff,
                  (deleted_at IS NULL) AS is_active, units_preference
        """,
        {"user_id": user_id, "is_staff": is_staff},
    ).fetchone()
    if row is None:
        raise RuntimeError("User is_staff update did not return a row.")
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
    target_user_id: UUID | None = None,
    target_email: str | None = None,
) -> None:
    """Append a row to ``user_action_log``.

    For admin lifecycle actions, ``user_id``/``email`` identify the *acting*
    admin and ``target_user_id``/``target_email`` identify the user the action
    was performed on. ``details`` must never carry secrets or raw tokens.
    """
    conn.execute(
        """
        INSERT INTO user_action_log (
            action, user_id, email, session_id, ip_address, user_agent, details,
            target_user_id, target_email
        )
        VALUES (
            %(action)s, %(user_id)s, %(email)s, %(session_id)s,
            %(ip_address)s, %(user_agent)s, %(details)s,
            %(target_user_id)s, %(target_email)s
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
            "target_user_id": target_user_id,
            "target_email": normalize_email(target_email) if target_email else None,
        },
    )


# --- Account tokens (invite / password-reset) ------------------------------

_ACCOUNT_TOKEN_COLUMNS = (
    "id, user_id, token_type, created_by, created_at, expires_at, "
    "consumed_at, revoked_at, request_ip, request_user_agent"
)


def revoke_active_account_tokens(
    conn: Connection[Any],
    user_id: UUID,
    token_type: str | None = None,
) -> int:
    """Revoke a user's active (unconsumed, unrevoked) account tokens.

    Pass ``token_type`` to revoke only invites or only resets (revoke-and-replace
    when issuing a fresh link); omit it to revoke every active token (on
    deactivate). Returns the number of tokens revoked.
    """
    rows = conn.execute(
        """
        UPDATE account_tokens
        SET revoked_at = now()
        WHERE user_id = %(user_id)s
          AND consumed_at IS NULL
          AND revoked_at IS NULL
          AND (%(token_type)s::text IS NULL OR token_type = %(token_type)s::text)
        RETURNING id
        """,
        {"user_id": user_id, "token_type": token_type},
    ).fetchall()
    return len(rows)


def insert_account_token(
    conn: Connection[Any],
    *,
    user_id: UUID,
    token_type: str,
    token_hash: str,
    expires_at: datetime,
    created_by: UUID | None,
    request_ip: str | None,
    request_user_agent: str | None,
) -> dict[str, Any]:
    """Insert a single active account token (only its keyed hash is stored).

    Callers must revoke any existing active token of the same type first; the
    ``uq_account_tokens_active`` partial unique index otherwise rejects the
    insert.
    """
    row = conn.execute(
        f"""
        INSERT INTO account_tokens (
            user_id, token_type, token_hash, expires_at, created_by,
            request_ip, request_user_agent
        )
        VALUES (
            %(user_id)s, %(token_type)s, %(token_hash)s, %(expires_at)s,
            %(created_by)s, %(request_ip)s, %(request_user_agent)s
        )
        RETURNING {_ACCOUNT_TOKEN_COLUMNS}
        """,
        {
            "user_id": user_id,
            "token_type": token_type,
            "token_hash": token_hash,
            "expires_at": expires_at,
            "created_by": created_by,
            "request_ip": request_ip,
            "request_user_agent": request_user_agent,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Account-token insert did not return a row.")
    return row


def get_account_token_by_hash_for_update(conn: Connection[Any], token_hash: str) -> dict[str, Any] | None:
    """Fetch a token row by its keyed hash, locked ``FOR UPDATE`` for atomic consume."""
    return conn.execute(
        f"""
        SELECT {_ACCOUNT_TOKEN_COLUMNS}
        FROM account_tokens
        WHERE token_hash = %(token_hash)s
        FOR UPDATE
        """,
        {"token_hash": token_hash},
    ).fetchone()


def consume_account_token(conn: Connection[Any], token_id: UUID) -> None:
    """Mark a token consumed (single-use). Idempotent via the COALESCE guard."""
    conn.execute(
        """
        UPDATE account_tokens
        SET consumed_at = COALESCE(consumed_at, now())
        WHERE id = %(token_id)s
        """,
        {"token_id": token_id},
    )
