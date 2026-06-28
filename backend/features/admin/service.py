"""Admin user-management workflow rules (no HTTP).

Each mutation runs in a single transaction, takes the locks it needs (notably
the last-admin lock before any demotion/deactivation), performs the change,
writes an audit row, and returns the refreshed dashboard row. The caller (the
Phase 04 routes) is responsible for the `admin.users.manage` authorization gate;
these functions assume an already-authorized actor and never trust the frontend.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from psycopg import Connection
from starlette import status

from database import transaction
from features.access import repository as access_repository
from features.access.capabilities import ADMIN_USERS_MANAGE
from features.admin import audit, repository
from features.admin.models import AdminAuditEntry, AdminUserRow, IssuedAccountLink
from features.auth import repository as auth_repository
from features.auth.account_token_service import issue_account_token
from features.auth.account_tokens import AccountTokenType
from features.auth.models import UserPublic
from features.auth.service import has_usable_password, now_utc
from features.mcp import repository as mcp_repository
from features.shared.errors import api_error

# Cap on the per-user audit history returned to the dashboard.
DEFAULT_AUDIT_LIMIT = 50


# --- Row mapping -----------------------------------------------------------


def _to_admin_user_row(row: dict[str, Any]) -> AdminUserRow:
    if row["deleted_at"] is not None:
        user_status = "inactive"
    elif row["password_set_at"] is None:
        user_status = "invited"
    else:
        user_status = "active"
    return AdminUserRow(
        id=row["id"],
        email=str(row["email"]),
        display_name=str(row["display_name"]),
        status=user_status,
        role="admin" if row["is_admin"] else "user",
        is_staff=bool(row["is_staff"]),
        created_at=row["created_at"],
        last_action_at=row["last_action_at"],
    )


def _require_user_row(conn: Connection[Any], user_id: UUID) -> AdminUserRow:
    row = repository.get_user_row(conn, user_id)
    if row is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "user_not_found", "No such user.")
    return _to_admin_user_row(row)


# --- Reads -----------------------------------------------------------------


def list_users() -> list[AdminUserRow]:
    with transaction() as conn:
        return [_to_admin_user_row(row) for row in repository.list_user_rows(conn)]


def list_user_audit(target_user_id: UUID, limit: int = DEFAULT_AUDIT_LIMIT) -> list[AdminAuditEntry]:
    with transaction() as conn:
        rows = repository.list_user_audit(conn, target_user_id, limit)
    return [
        AdminAuditEntry(
            id=row["id"],
            action=str(row["action"]),
            actor_user_id=row["actor_user_id"],
            actor_email=row["actor_email"],
            target_email=row["target_email"],
            ip_address=row["ip_address"],
            created_at=row["created_at"],
            details=dict(row["details"] or {}),
        )
        for row in rows
    ]


# --- Helpers shared by the mutations ---------------------------------------


def _grant_admin(conn: Connection[Any], actor: UserPublic, user_id: UUID) -> bool:
    """Grant the global Admin capability if missing. Returns True if newly granted."""
    return access_repository.ensure_global_grant(
        conn, user_id=user_id, capability=ADMIN_USERS_MANAGE, granted_by=actor.id
    )


def _revoke_all_access(conn: Connection[Any], user_id: UUID, now: datetime, reason: str) -> None:
    """Hard-stop a user: kill sessions, account tokens, and attributable MCP tokens."""
    auth_repository.invalidate_active_sessions(conn, user_id=user_id, reason=reason, invalidated_at=now)
    auth_repository.revoke_active_account_tokens(conn, user_id)
    mcp_repository.revoke_tokens_for_user(conn, user_id)


# --- Mutations -------------------------------------------------------------


def invite_user(
    actor: UserPublic,
    *,
    email: str,
    display_name: str,
    make_admin: bool,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[AdminUserRow, IssuedAccountLink]:
    """Create (or reactivate) a user in the invited state and issue an invite link."""
    now = now_utc()
    with transaction() as conn:
        user = auth_repository.upsert_invited_user(conn, email=email, display_name=display_name)
        user_id = user["id"]
        target_email = str(user["email"])

        if make_admin and _grant_admin(conn, actor, user_id):
            audit.log_admin_action(
                conn,
                action=audit.ADMIN_CAPABILITY_GRANTED,
                actor=actor,
                target_user_id=user_id,
                target_email=target_email,
                ip_address=ip_address,
                user_agent=user_agent,
                details={"capability": ADMIN_USERS_MANAGE},
            )

        _row, link = issue_account_token(
            conn,
            user_id=user_id,
            token_type="invite",
            created_by=actor.id,
            now=now,
            request_ip=ip_address,
            request_user_agent=user_agent,
        )
        audit.log_admin_action(
            conn,
            action=audit.ADMIN_USER_INVITED,
            actor=actor,
            target_user_id=user_id,
            target_email=target_email,
            ip_address=ip_address,
            user_agent=user_agent,
            details={"role": "admin" if make_admin else "user"},
        )
        return _require_user_row(conn, user_id), IssuedAccountLink(token_type="invite", link=link)


def generate_reset_link(
    actor: UserPublic,
    *,
    target_user_id: UUID,
    ip_address: str | None,
    user_agent: str | None,
) -> IssuedAccountLink:
    """Issue an admin-triggered password-reset link for an active user."""
    now = now_utc()
    with transaction() as conn:
        user = auth_repository.get_user_account_for_update(conn, target_user_id)
        if user is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "user_not_found", "No such user.")
        if not user["is_active"]:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "user_inactive",
                "Reactivate the user before issuing a reset link.",
            )

        _row, link = issue_account_token(
            conn,
            user_id=target_user_id,
            token_type="password_reset",
            created_by=actor.id,
            now=now,
            request_ip=ip_address,
            request_user_agent=user_agent,
        )
        audit.log_admin_action(
            conn,
            action=audit.ADMIN_RESET_LINK_GENERATED,
            actor=actor,
            target_user_id=target_user_id,
            target_email=str(user["email"]),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return IssuedAccountLink(token_type="password_reset", link=link)


def deactivate_user(
    actor: UserPublic,
    *,
    target_user_id: UUID,
    ip_address: str | None,
    user_agent: str | None,
) -> AdminUserRow:
    """Soft-deactivate a user and revoke their sessions/tokens. Last-admin safe."""
    now = now_utc()
    with transaction() as conn:
        active_admins = repository.lock_active_admin_user_ids(conn)
        user = auth_repository.get_user_account_for_update(conn, target_user_id)
        if user is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "user_not_found", "No such user.")
        if not user["is_active"]:
            raise api_error(status.HTTP_409_CONFLICT, "user_inactive", "User is already inactive.")
        if active_admins == {target_user_id}:
            raise api_error(status.HTTP_409_CONFLICT, "last_admin", "Cannot deactivate the last active admin.")

        auth_repository.set_user_active(conn, target_user_id, active=False)
        _revoke_all_access(conn, target_user_id, now, reason="user_deactivated")
        audit.log_admin_action(
            conn,
            action=audit.ADMIN_USER_DEACTIVATED,
            actor=actor,
            target_user_id=target_user_id,
            target_email=str(user["email"]),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return _require_user_row(conn, target_user_id)


def reactivate_user(
    actor: UserPublic,
    *,
    target_user_id: UUID,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[AdminUserRow, IssuedAccountLink]:
    """Reactivate a user and issue a fresh invite/reset link so they re-establish access."""
    now = now_utc()
    with transaction() as conn:
        user = auth_repository.get_user_account_for_update(conn, target_user_id)
        if user is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "user_not_found", "No such user.")
        if user["is_active"]:
            raise api_error(status.HTTP_409_CONFLICT, "user_active", "User is already active.")

        auth_repository.set_user_active(conn, target_user_id, active=True)
        # An existing-password account gets a reset; one that never set a password
        # is still effectively an invite.
        token_type: AccountTokenType = "password_reset" if has_usable_password(user) else "invite"
        _row, link = issue_account_token(
            conn,
            user_id=target_user_id,
            token_type=token_type,
            created_by=actor.id,
            now=now,
            request_ip=ip_address,
            request_user_agent=user_agent,
        )
        audit.log_admin_action(
            conn,
            action=audit.ADMIN_USER_REACTIVATED,
            actor=actor,
            target_user_id=target_user_id,
            target_email=str(user["email"]),
            ip_address=ip_address,
            user_agent=user_agent,
            details={"token_type": token_type},
        )
        return _require_user_row(conn, target_user_id), IssuedAccountLink(token_type=token_type, link=link)


def set_admin(
    actor: UserPublic,
    *,
    target_user_id: UUID,
    make_admin: bool,
    ip_address: str | None,
    user_agent: str | None,
) -> AdminUserRow:
    """Grant or revoke the Admin preset. Revocation is last-admin safe."""
    with transaction() as conn:
        active_admins = repository.lock_active_admin_user_ids(conn)
        user = auth_repository.get_user_account_for_update(conn, target_user_id)
        if user is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "user_not_found", "No such user.")
        target_email = str(user["email"])

        if make_admin:
            if _grant_admin(conn, actor, target_user_id):
                audit.log_admin_action(
                    conn,
                    action=audit.ADMIN_CAPABILITY_GRANTED,
                    actor=actor,
                    target_user_id=target_user_id,
                    target_email=target_email,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details={"capability": ADMIN_USERS_MANAGE},
                )
        else:
            if active_admins == {target_user_id}:
                raise api_error(status.HTTP_409_CONFLICT, "last_admin", "Cannot demote the last active admin.")
            revoked = access_repository.revoke_grant(
                conn,
                user_id=target_user_id,
                capability=ADMIN_USERS_MANAGE,
                scope_type="global",
                scope_id=None,
            )
            if revoked:
                audit.log_admin_action(
                    conn,
                    action=audit.ADMIN_CAPABILITY_REVOKED,
                    actor=actor,
                    target_user_id=target_user_id,
                    target_email=target_email,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details={"capability": ADMIN_USERS_MANAGE},
                )
        return _require_user_row(conn, target_user_id)
