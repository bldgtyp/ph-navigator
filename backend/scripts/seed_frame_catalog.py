"""Load the canonical frame-types seed JSON into the local catalog.

Reads the committed `features/catalogs/frame_types/seeds/frame-types.v1.json`
envelope and pipes it through the same preview → commit pipeline the HTTP
routes use. Idempotent on `id` (rows already present in the catalog with
the same id are skipped); fresh ids are minted for seed rows that have
none, so the FIRST run is the realistic case and subsequent runs insert
duplicates unless the user re-exports the live catalog into the seed file.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

from fastapi import Request

from features.auth.service import create_or_update_user
from features.catalogs.frame_types.import_export.service import commit_import, preview_import

DEFAULT_SEED_PATH = (
    pathlib.Path(__file__).resolve().parent.parent
    / "features"
    / "catalogs"
    / "frame_types"
    / "seeds"
    / "frame-types.v1.json"
)
DEFAULT_EMAIL = "ed@example.com"
DEFAULT_PASSWORD = "password"
DEFAULT_DISPLAY_NAME = "Ed May"


def _fake_request() -> Request:
    """Build a minimal Starlette Request stub for audit logging.

    Audit log calls only read `client.host` and the User-Agent header;
    a bare ASGI scope with those fields is enough.
    """
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/scripts/seed_frame_catalog",
        "headers": [(b"user-agent", b"seed-frame-catalog")],
        "client": ("127.0.0.1", 0),
        "query_string": b"",
    }
    return Request(scope)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the local frame-types catalog.")
    parser.add_argument("--seed", type=pathlib.Path, default=DEFAULT_SEED_PATH)
    parser.add_argument("--email", default=DEFAULT_EMAIL)
    parser.add_argument("--display-name", default=DEFAULT_DISPLAY_NAME)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    args = parser.parse_args()

    if not args.seed.is_file():
        print(f"Seed file not found: {args.seed}", file=sys.stderr)
        raise SystemExit(2)

    payload = json.loads(args.seed.read_text())
    user = create_or_update_user(email=args.email, display_name=args.display_name, password=args.password)

    preview = preview_import(payload, user)
    print(
        f"Preview: new={preview.counts.new} matched={preview.counts.matched} "
        f"errored={preview.counts.errored} warnings={preview.counts.warnings}"
    )
    for warning in preview.warnings:
        print(f"  warning {warning.reason} on rows {warning.row_indices[:5]}")
    for error in preview.errors:
        print(f"  error {error.reason} on rows {error.row_indices[:5]}")

    if preview.counts.new == 0:
        print("Nothing new to commit; exiting.")
        return

    commit = commit_import(preview.token, user, _fake_request())
    print(f"Committed: inserted={commit.inserted} skipped_conflict={len(commit.skipped_conflict_ids)}")


if __name__ == "__main__":
    main()
