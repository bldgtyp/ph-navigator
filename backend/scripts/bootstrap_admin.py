"""Audited first-admin bootstrap / break-glass recovery.

The one operator path that is allowed to run in **production**. It creates or
repairs the first `admin.users.manage` account and issues a single-use
invite/reset link the operator hands to the admin out-of-band. It never sets or
prints a reusable password.

    # local / staging
    uv run python -m scripts.bootstrap_admin --email ed@example.com --display-name "Ed May"

    # production (explicit confirmation required)
    uv run python -m scripts.bootstrap_admin --email ed@example.com \
        --display-name "Ed May" --confirm-production

Behavior, in one transaction:

1. Create the user (invited, no password) or reactivate/keep an existing one.
2. Ensure they hold the global ``admin.users.manage`` grant.
3. Issue an ``invite`` link if they have no password yet, otherwise a
   ``password_reset`` link (break-glass for an existing admin).
4. Write audit rows for the grant and the link.

The raw link is printed once to stdout for the operator and never persisted.
"""

from __future__ import annotations

import argparse
from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.errors import UniqueViolation

from config import settings
from database import transaction
from features.access import repository as access_repository
from features.access.capabilities import ADMIN_USERS_MANAGE
from features.auth import repository as auth_repository
from features.auth.account_token_service import issue_account_token
from features.auth.account_tokens import AccountTokenType
from features.auth.service import has_usable_password, now_utc

_BOOTSTRAP_USER_AGENT = "scripts.bootstrap_admin"


def _assert_environment_allowed(confirm_production: bool) -> None:
    """Allow production only with explicit confirmation; never block lower envs."""
    if settings.environment == "production" and not confirm_production:
        raise SystemExit(
            "Refusing to bootstrap a production admin without --confirm-production. "
            "Re-run with that flag once you are sure this is the intended database."
        )


def _ensure_admin_grant(conn: Connection[Any], user_id: UUID) -> bool:
    """Grant ``admin.users.manage`` globally if missing. Returns True if granted."""
    try:
        access_repository.insert_grant(
            conn,
            user_id=user_id,
            capability=ADMIN_USERS_MANAGE,
            scope_type="global",
            scope_id=None,
            granted_by=None,
        )
    except UniqueViolation:
        return False
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap or repair the first admin account.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--display-name", required=True)
    parser.add_argument(
        "--confirm-production",
        action="store_true",
        help="Required to run when ENVIRONMENT=production.",
    )
    args = parser.parse_args()
    _assert_environment_allowed(args.confirm_production)

    now = now_utc()
    with transaction() as conn:
        existing = auth_repository.get_user_by_email(conn, args.email)
        user = auth_repository.upsert_invited_user(conn, email=args.email, display_name=args.display_name)
        user_id = user["id"]
        email = str(user["email"])

        # An existing user who already has a password gets a break-glass reset;
        # a brand-new or still-invited user gets an invite.
        token_type: AccountTokenType = "password_reset" if has_usable_password(existing) else "invite"

        granted = _ensure_admin_grant(conn, user_id)
        if granted:
            auth_repository.log_action(
                conn,
                action="admin_capability_granted",
                user_id=None,
                email=None,
                session_id=None,
                ip_address=None,
                user_agent=_BOOTSTRAP_USER_AGENT,
                details={"capability": ADMIN_USERS_MANAGE, "via": "bootstrap"},
                target_user_id=user_id,
                target_email=email,
            )

        _row, raw_link = issue_account_token(
            conn,
            user_id=user_id,
            token_type=token_type,
            created_by=None,
            now=now,
            request_ip=None,
            request_user_agent=_BOOTSTRAP_USER_AGENT,
        )
        auth_repository.log_action(
            conn,
            action="admin_user_invited" if token_type == "invite" else "admin_reset_link_generated",
            user_id=None,
            email=None,
            session_id=None,
            ip_address=None,
            user_agent=_BOOTSTRAP_USER_AGENT,
            details={"token_type": token_type, "via": "bootstrap"},
            target_user_id=user_id,
            target_email=email,
        )

    print(f"Bootstrapped admin {email} ({user_id}).")
    print(f"Admin capability: {'granted now' if granted else 'already present'}.")
    print(f"One-time {token_type} link (hand to the admin, do not store):\n  {raw_link}")


if __name__ == "__main__":
    main()
