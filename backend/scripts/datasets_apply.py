"""Apply one or all pending licensed db-seed datasets."""

from __future__ import annotations

import argparse
from urllib.parse import urlparse

from config import settings
from database import transaction
from features.datasets.apply import apply_all_pending, apply_dataset
from features.datasets.manifest import DatasetManifestStore
from scripts._seed_paths import LOCAL_ENVIRONMENTS


def _guard_environment() -> None:
    database_host = urlparse(settings.database_url).hostname
    is_local = settings.environment in LOCAL_ENVIRONMENTS and database_host in {
        "localhost",
        "127.0.0.1",
        "db",
    }
    if not is_local and not settings.phn_datasets_allow_production:
        raise SystemExit(
            "Refusing to apply datasets to a non-local database. "
            "Set PHN_DATASETS_ALLOW_PRODUCTION=1 only in a deliberate production job."
        )
    if not is_local and settings.phn_datasets_allow_production and settings.phn_datasets_applied_by == "local-cli":
        raise SystemExit(
            "PHN_DATASETS_APPLIED_BY must name the production workflow/operator; "
            "the default 'local-cli' identity is not allowed in production."
        )


def _report(
    slug: str,
    version: str,
    sha256: str,
    *,
    matched: int,
    updated: int,
    unchanged: int,
    unmatched: int,
) -> None:
    print(
        f"{slug} v{version} sha256={sha256} "
        f"matched={matched} updated={updated} unchanged={unchanged} unmatched={unmatched}"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--slug")
    mode.add_argument("--all-pending", action="store_true")
    args = parser.parse_args(argv)

    _guard_environment()
    if not settings.r2_endpoint_url:
        raise SystemExit("R2_ENDPOINT_URL is required; start local storage with `make object-store-init`.")
    store = DatasetManifestStore.from_settings()
    with transaction() as conn:
        if args.slug is not None:
            results = (
                apply_dataset(
                    conn,
                    slug=args.slug,
                    applied_by=settings.phn_datasets_applied_by,
                    store=store,
                ),
            )
        else:
            results = apply_all_pending(
                conn,
                applied_by=settings.phn_datasets_applied_by,
                store=store,
            )

    if not results:
        print("No pending db-seed datasets.")
        return 0
    for result in results:
        _report(
            result.slug,
            result.version,
            result.sha256,
            matched=result.report.matched,
            updated=result.report.updated,
            unchanged=result.report.unchanged,
            unmatched=len(result.report.unmatched),
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
