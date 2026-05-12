"""Create or reset an editor account for local development."""

from __future__ import annotations

import argparse
import getpass

from config import settings
from features.auth.service import create_or_update_user

LOCAL_ENVIRONMENTS = {"development", "test", "local"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a PHN-V2 editor user.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--display-name", required=True)
    parser.add_argument("--password")
    args = parser.parse_args()

    if settings.environment not in LOCAL_ENVIRONMENTS:
        raise SystemExit(
            "Refusing to seed/reset an editor user outside local environments. "
            f"Current ENVIRONMENT={settings.environment!r}."
        )

    password = args.password or getpass.getpass("Password: ")
    user = create_or_update_user(email=args.email, display_name=args.display_name, password=password)
    print(f"Seeded editor user {user.email} ({user.id})")


if __name__ == "__main__":
    main()
