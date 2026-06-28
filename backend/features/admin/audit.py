"""Centralized audit logging for sensitive admin user-management actions.

Every MVP lifecycle mutation writes a ``user_action_log`` row recording the
*acting* admin, the *target* user, the request IP/user-agent, and scrubbed
before/after detail. Action keys are constants so the route and service layers
cannot drift on spelling, and `scrub_details` is a hard backstop against a raw
token or password ever reaching an audit row.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection

from features.auth import repository as auth_repository
from features.auth.models import UserPublic

# Admin-initiated MVP audit actions (PRD §Audit). The self-service completion
# actions (`password_reset_completed`, `account_invite_completed`) are written by
# the public completion path and live in `features.auth.account_completion`.
ADMIN_USER_INVITED = "admin_user_invited"
ADMIN_RESET_LINK_GENERATED = "admin_reset_link_generated"
ADMIN_USER_DEACTIVATED = "admin_user_deactivated"
ADMIN_USER_REACTIVATED = "admin_user_reactivated"
ADMIN_CAPABILITY_GRANTED = "admin_capability_granted"
ADMIN_CAPABILITY_REVOKED = "admin_capability_revoked"

# Detail keys that must never be persisted to an audit row, even if a caller
# passes them by mistake. The raw link/token/password are returned to the
# immediate caller only.
_FORBIDDEN_DETAIL_SUBSTRINGS = ("token", "password", "secret", "link", "hash")


def scrub_details(details: dict[str, Any] | None) -> dict[str, Any]:
    """Drop any detail key that could carry a secret before it is stored."""
    if not details:
        return {}
    return {
        key: value
        for key, value in details.items()
        if not any(bad in key.lower() for bad in _FORBIDDEN_DETAIL_SUBSTRINGS)
    }


def log_admin_action(
    conn: Connection[Any],
    *,
    action: str,
    actor: UserPublic | None,
    target_user_id: UUID,
    target_email: str,
    ip_address: str | None,
    user_agent: str | None,
    details: dict[str, Any] | None = None,
) -> None:
    """Write one admin audit row (acting admin -> target user)."""
    auth_repository.log_action(
        conn,
        action=action,
        user_id=actor.id if actor else None,
        email=str(actor.email) if actor else None,
        session_id=None,
        ip_address=ip_address,
        user_agent=user_agent,
        details=scrub_details(details),
        target_user_id=target_user_id,
        target_email=target_email,
    )
