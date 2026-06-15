"""The provider-agnostic *seed* step: standardized bundle → Postgres (PRD D-CS-3).

The counterpart to :mod:`features.climate.processing`. It reads a single
:class:`~features.climate.bundle.ClimateBundle` — from the object store
(MinIO / R2) or a local file — and hands its records to
:func:`features.climate.service.seed_dataset`. It knows nothing about Phius or
PHI source formats; the bundle is self-describing
(provider / version / label / source), so the same code seeds every provider.

    # dev + prod: pull phius/2022 from the object store and (re)seed it
    uv run python -m features.climate.seeding --provider phius --version 2022

    # prod (Render): seed every published provider in one stable command
    uv run python -m features.climate.seeding --all

    # seed straight from a local bundle file instead of the object store
    uv run python -m features.climate.seeding --from-file climate/phius/2022/dataset.json

``--all`` walks the provider registry and seeds each provider's default version
that is published in the object store, so the production seed job (PRD D-CS-7)
is a single command that never changes as new providers are added (D-CS-3).

Idempotent per ``(provider, version)`` (see ``seed_dataset``); ``--no-replace``
leaves an existing release untouched. Run from ``backend/`` so the project
``Settings`` (database + object-store credentials) load.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from config import settings
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


def seed_all_from_object_store(
    store: ClimateBundleStore, *, replace: bool = True
) -> tuple[list[SeedResult], list[tuple[str, str]]]:
    """Seed every registered provider's default version that is published.

    Walks the provider registry — so a newly registered provider is picked up
    here with no change to this CLI (PRD D-CS-3) — and seeds each provider
    whose default-version bundle is present in the object store. Returns the
    seeded results and the ``(provider, version)`` pairs skipped because no
    bundle is published yet, so the caller reports both instead of failing
    silently on a partially-published registry.
    """
    seeded: list[SeedResult] = []
    skipped: list[tuple[str, str]] = []
    for provider in provider_names():
        version = resolve_version(provider, None)
        if store.has_bundle(provider, version):
            seeded.append(seed_from_object_store(store, provider, version, replace=replace))
        else:
            skipped.append((provider, version))
    return seeded, skipped


def _object_store() -> ClimateBundleStore:
    """The R2/MinIO-backed bundle store, or exit if the object store is unconfigured."""
    if not settings.r2_endpoint_url:
        raise SystemExit(
            "R2_ENDPOINT_URL is required to seed from the object store; "
            "start the object store with `make object-store-init`."
        )
    return ClimateBundleStore.from_settings()


def _report(result: SeedResult, *, no_replace: bool) -> None:
    verb = "skipped (already seeded)" if (no_replace and not result.replaced) else "seeded"
    print(f"{verb}: {result.provider} {result.version} — {result.location_count} locations")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="features.climate.seeding", description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--provider", choices=provider_names(), help="Provider to pull from the object store.")
    mode.add_argument(
        "--all",
        action="store_true",
        dest="seed_all",
        help="Seed every registered provider's default version that is published in the object store.",
    )
    mode.add_argument("--from-file", type=Path, help="Seed from a local bundle file instead of the object store.")
    parser.add_argument("--version", help="Dataset version tag (default: the provider's default).")
    parser.add_argument(
        "--no-replace",
        action="store_true",
        help="Leave an existing (provider, version) release untouched instead of rebuilding it.",
    )
    args = parser.parse_args(argv)
    replace = not args.no_replace

    if args.from_file is not None:
        _report(seed_from_file(args.from_file, replace=replace), no_replace=args.no_replace)
        return 0

    if args.seed_all:
        seeded, skipped = seed_all_from_object_store(_object_store(), replace=replace)
        for result in seeded:
            _report(result, no_replace=args.no_replace)
        for provider, version in skipped:
            print(f"skipped (no bundle published): {provider} {version}")
        if not seeded:
            raise SystemExit(
                "No published climate bundles found in the object store; "
                "publish one with `features.climate.processing --upload` first."
            )
        return 0

    if args.provider is None:
        parser.error("one of --provider, --all, or --from-file is required.")
    version = resolve_version(args.provider, args.version)
    result = seed_from_object_store(_object_store(), args.provider, version, replace=replace)
    _report(result, no_replace=args.no_replace)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
