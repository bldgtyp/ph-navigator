"""Create or reset an editor account for local/staging setup."""

from __future__ import annotations

import argparse
import getpass

from config import settings
from features.auth.service import create_or_update_user

LOCAL_ENVIRONMENTS = {"development", "test", "local"}
STAGING_ENVIRONMENT = "staging"


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a PHN-V2 editor user.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--display-name", required=True)
    parser.add_argument("--password")
    parser.add_argument(
        "--allow-staging",
        action="store_true",
        help="Allow the command to run when ENVIRONMENT=staging. Production is always refused.",
    )
    args = parser.parse_args()

    can_seed = settings.environment in LOCAL_ENVIRONMENTS or (
        settings.environment == STAGING_ENVIRONMENT and args.allow_staging
    )
    if not can_seed:
        raise SystemExit(
            "Refusing to seed/reset an editor user outside local environments without explicit staging approval. "
            f"Current ENVIRONMENT={settings.environment!r}."
        )

    password = args.password or getpass.getpass("Password: ")
    user = create_or_update_user(email=args.email, display_name=args.display_name, password=password)
    print(f"Seeded editor user {user.email} ({user.id})")


if __name__ == "__main__":
    main()
