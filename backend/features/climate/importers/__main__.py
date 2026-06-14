"""CLI entry point for seeding the app-wide climate reference datasets.

Re-runnable and idempotent per ``(provider, version)`` — point it at a
local source tree and it (re)builds that release in one transaction. The
raw Phius/PHI source files are not committed to the repo (large, and Ed
keeps the canonical copies); the operator supplies ``--root``.

    uv run python -m features.climate.importers \
        --provider phius --root /path/to/phius_2022_climate_data

Run from ``backend/`` so the project ``Settings`` (database URL) load.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from features.climate.importers.phius import seed_phius_dataset
from features.climate.service import SeedResult


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="features.climate.importers", description=__doc__)
    parser.add_argument("--provider", choices=("phius",), required=True, help="Reference-dataset provider to seed.")
    parser.add_argument("--root", type=Path, required=True, help="Directory holding the source files.")
    parser.add_argument("--version", default="2022", help="Dataset version tag (default: 2022).")
    parser.add_argument(
        "--no-replace",
        action="store_true",
        help="Leave an existing (provider, version) release untouched instead of rebuilding it.",
    )
    args = parser.parse_args(argv)

    if not args.root.is_dir():
        parser.error(f"--root is not a directory: {args.root}")

    result = _seed(args)
    verb = "skipped (already seeded)" if (args.no_replace and not result.replaced) else "seeded"
    print(f"{verb}: {result.provider} {result.version} — {result.location_count} locations")
    return 0


def _seed(args: argparse.Namespace) -> SeedResult:
    """Dispatch to the provider's seed routine (only Phius today)."""
    return seed_phius_dataset(args.root, version=args.version, replace=not args.no_replace)


if __name__ == "__main__":
    raise SystemExit(main())
