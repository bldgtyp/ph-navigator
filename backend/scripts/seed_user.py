"""Create or reset an editor account for local/staging setup."""

from __future__ import annotations

import argparse
import getpass

from features.auth.service import create_or_update_user
from scripts._seed_paths import assert_local_or_staging


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

    assert_local_or_staging(args.allow_staging)

    password = args.password or getpass.getpass("Password: ")
    user = create_or_update_user(email=args.email, display_name=args.display_name, password=password)
    print(f"Seeded editor user {user.email} ({user.id})")


if __name__ == "__main__":
    main()
