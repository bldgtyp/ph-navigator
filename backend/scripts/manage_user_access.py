"""Grant/revoke capabilities and toggle the staff flag for a user.

Local/staging seed + admin tooling for the access capability model
(planning/archive/dated/2026-06-27/access-capability-model). The first real use is the
catalog-admin grant:

    uv run python -m scripts.manage_user_access grant \
        --email ed@example.com --capability catalog.edit --scope global

    uv run python -m scripts.manage_user_access set-staff --email ed@example.com

The capability string is not validated here — the resolver (a later phase) owns
the capability namespace; this tool only persists grants.
"""

from __future__ import annotations

import argparse
from typing import Any
from uuid import UUID

from psycopg.errors import UniqueViolation

from database import transaction
from features.access import repository as access_repository
from features.access.models import GRANT_SCOPE_TYPES, GrantScopeType
from features.auth import repository as auth_repository
from scripts._seed_paths import assert_local_or_staging


def _resolve_user(conn: Any, email: str) -> dict[str, Any]:
    user = auth_repository.get_user_by_email(conn, email)
    if user is None:
        raise SystemExit(f"No user found with email {email!r}.")
    return user


def _scope_id_from_args(scope_type: GrantScopeType, raw_scope_id: str | None) -> UUID | None:
    if scope_type == "global":
        if raw_scope_id is not None:
            raise SystemExit("--scope-id is not allowed for a global grant.")
        return None
    if raw_scope_id is None:
        raise SystemExit(f"--scope-id is required for a {scope_type} grant.")
    return UUID(raw_scope_id)


def _grant(args: argparse.Namespace) -> None:
    scope_id = _scope_id_from_args(args.scope, args.scope_id)
    try:
        with transaction() as conn:
            user = _resolve_user(conn, args.email)
            grant = access_repository.insert_grant(
                conn,
                user_id=user["id"],
                capability=args.capability,
                scope_type=args.scope,
                scope_id=scope_id,
                # The grant is issued by the system/operator via the CLI, not by
                # the recipient; record no granting user rather than self-attribute.
                granted_by=None,
            )
    except UniqueViolation:
        raise SystemExit(f"{args.email} already has an active {args.capability!r} ({args.scope}) grant.") from None
    print(f"Granted {args.capability!r} ({args.scope}) to {user['email']} — grant {grant['id']}.")


def _revoke(args: argparse.Namespace) -> None:
    scope_id = _scope_id_from_args(args.scope, args.scope_id)
    with transaction() as conn:
        user = _resolve_user(conn, args.email)
        revoked = access_repository.revoke_grant(
            conn,
            user_id=user["id"],
            capability=args.capability,
            scope_type=args.scope,
            scope_id=scope_id,
        )
    if revoked:
        print(f"Revoked {args.capability!r} ({args.scope}) from {user['email']}.")
    else:
        print(f"No active {args.capability!r} ({args.scope}) grant for {user['email']}.")


def _set_staff(args: argparse.Namespace) -> None:
    is_staff = not args.off
    with transaction() as conn:
        user = _resolve_user(conn, args.email)
        updated = auth_repository.set_user_is_staff(conn, user["id"], is_staff)
    print(f"Set is_staff={updated['is_staff']} for {updated['email']}.")


def _add_grant_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--email", required=True)
    parser.add_argument("--capability", required=True, help="A capability key, e.g. 'catalog.edit'.")
    parser.add_argument("--scope", required=True, choices=GRANT_SCOPE_TYPES)
    parser.add_argument("--scope-id", help="Team or project UUID; omit for --scope global.")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage a user's capability grants and staff flag.")
    parser.add_argument(
        "--allow-staging",
        action="store_true",
        help="Allow the command to run when ENVIRONMENT=staging. Production is always refused.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    grant_parser = subparsers.add_parser("grant", help="Grant a capability to a user.")
    _add_grant_arguments(grant_parser)
    grant_parser.set_defaults(handler=_grant)

    revoke_parser = subparsers.add_parser("revoke", help="Revoke an active capability grant.")
    _add_grant_arguments(revoke_parser)
    revoke_parser.set_defaults(handler=_revoke)

    staff_parser = subparsers.add_parser("set-staff", help="Toggle the bldgtyp staff flag.")
    staff_parser.add_argument("--email", required=True)
    staff_parser.add_argument("--off", action="store_true", help="Clear the flag instead of setting it.")
    staff_parser.set_defaults(handler=_set_staff)

    return parser


def main() -> None:
    args = _build_parser().parse_args()
    assert_local_or_staging(args.allow_staging)
    args.handler(args)


if __name__ == "__main__":
    main()
