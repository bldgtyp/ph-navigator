"""The provider-agnostic *seed* step: standardized bundle → Postgres (PRD D-CS-3).

The counterpart to :mod:`features.climate.processing`. It reads a single
:class:`~features.climate.bundle.ClimateBundle` — from the object store
(MinIO / R2) or a local file — and hands its records to
:func:`features.climate.service.seed_dataset`. It knows nothing about Phius or
PHI source formats; the bundle is self-describing
(provider / version / label / source), so the same code seeds every provider.

    # dev + prod: pull phius/2022 from the object store and (re)seed it
    uv run python -m features.climate.seeding --provider phius --version 2022

    # seed straight from a local bundle file instead of the object store
    uv run python -m features.climate.seeding --from-file climate/phius/2022/dataset.json

Idempotent per ``(provider, version)`` (see ``seed_dataset``); ``--no-replace``
leaves an existing release untouched. Run from ``backend/`` so the project
``Settings`` (database + object-store credentials) load.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from config import settings
from features.assets.storage_r2 import R2Client
from features.climate.bundle import ClimateBundle
from features.climate.importers import provider_names, resolve_version
from features.climate.object_store import ClimateBundleStore
from features.climate.service import SeedResult, seed_dataset


def seed_from_bundle(bundle: ClimateBundle, *, replace: bool = True) -> SeedResult:
    """Seed one standardized bundle into the ``climate_dataset*`` tables."""
    return seed_dataset(
        bundle.provider,
        bundle.version,
        bundle.records,
        label=bundle.label,
        source=bundle.source,
        replace=replace,
    )


def seed_from_object_store(
    store: ClimateBundleStore, provider: str, version: str, *, replace: bool = True
) -> SeedResult:
    """Pull ``(provider, version)`` from the object store and seed it."""
    return seed_from_bundle(store.get_bundle(provider, version), replace=replace)


def seed_from_file(path: Path, *, replace: bool = True) -> SeedResult:
    """Seed from a local standardized bundle file."""
    return seed_from_bundle(ClimateBundle.from_json_bytes(path.read_bytes()), replace=replace)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="features.climate.seeding", description=__doc__)
    parser.add_argument("--provider", choices=provider_names(), help="Provider to pull from the object store.")
    parser.add_argument("--version", help="Dataset version tag (default: the provider's default).")
    parser.add_argument("--from-file", type=Path, help="Seed from a local bundle file instead of the object store.")
    parser.add_argument(
        "--no-replace",
        action="store_true",
        help="Leave an existing (provider, version) release untouched instead of rebuilding it.",
    )
    args = parser.parse_args(argv)
    replace = not args.no_replace

    if args.from_file is not None:
        result = seed_from_file(args.from_file, replace=replace)
    else:
        if args.provider is None:
            parser.error("--provider is required when seeding from the object store (or pass --from-file).")
        if not settings.r2_endpoint_url:
            raise SystemExit(
                "R2_ENDPOINT_URL is required to seed from the object store; "
                "start the object store with `make object-store-init`."
            )
        version = resolve_version(args.provider, args.version)
        store = ClimateBundleStore(R2Client(settings))
        result = seed_from_object_store(store, args.provider, version, replace=replace)

    verb = "skipped (already seeded)" if (args.no_replace and not result.replaced) else "seeded"
    print(f"{verb}: {result.provider} {result.version} — {result.location_count} locations")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
