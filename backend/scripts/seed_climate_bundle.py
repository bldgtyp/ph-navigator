"""Ensure the object store holds the climate bundles for dev seeding.

The dev DB seed (:mod:`scripts.seed_dev_db`) pulls the standardized climate
bundles from the object store (PRD D-CS-2) — and seeds *every* published
provider, mirroring prod's ``seeding --all`` — but a fresh MinIO starts empty.
This script bootstraps the bucket, the same role :mod:`scripts.init_object_store`
plays for the attachment bucket. It builds each provider's bundle from the
operator's local raw source when needed, so a fresh dev gets seedable Phius
**and** PHI data.

    make object-store-init
    cd backend && uv run python -m scripts.seed_climate_bundle

Per provider (``$<source_env>`` is the operator's raw source tree; absent it
defaults to the provider's slice under ``backend/seeds/climate/`` — the
gitignored 24-station Phius NY slice, and ``phi/`` for the PHI workbook):

- source env set            → (re)build from it and upload (the operator chose
  this tree, so publishing it — replacing any existing bundle — is intended);
- no override, bundle already in the store → **reuse it** (never clobber a
  published bundle with a small default slice — this is what lets a plain
  ``make db-reset-dev`` keep the full library that was published once);
- no override, no bundle yet → bootstrap-upload from the default slice when one
  is present;
- nothing buildable and no bundle → fail loudly for a **required** provider
  (Phius, the starter project's default); **skip** an optional one (PHI, whose
  picker degrades to an empty state until a dataset lands).

To deliberately refresh a bundle from its default slice, point its source env at
that slice (e.g. ``CLIMATE_SOURCE_DIR=backend/seeds/climate``).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from config import settings
from features.climate.bundle import ClimateBundle
from features.climate.object_store import ClimateBundleStore
from features.climate.processing import EmptySourceError, build_bundle
from scripts._seed_paths import CLIMATE_PHI_ROOT, CLIMATE_PHIUS_ROOT, assert_local_dev_database


@dataclass(frozen=True)
class _BundleSpec:
    """One ``(provider, version)`` bundle the dev bootstrap can publish.

    ``default_root`` is the local source used when no bundle is published and
    ``source_env`` is unset; ``source_env`` names the env var that points the
    pipeline at a tree elsewhere. ``required`` providers fail loudly when
    nothing is buildable and nothing is published; optional ones are skipped.
    """

    provider: str
    version: str
    default_root: Path
    source_env: str
    required: bool


# Bootstrapped for local dev. Other (provider, version) releases are published
# with the admin `python -m features.climate.processing --upload` CLI.
_BOOTSTRAP_SPECS: tuple[_BundleSpec, ...] = (
    _BundleSpec("phius", "2022", CLIMATE_PHIUS_ROOT, "CLIMATE_SOURCE_DIR", required=True),
    _BundleSpec("phi", "10.6", CLIMATE_PHI_ROOT, "CLIMATE_PHI_SOURCE_DIR", required=False),
)


def ensure_bundle(store: ClimateBundleStore, spec: _BundleSpec, *, explicit_source: str | None) -> str:
    """Ensure ``spec``'s bundle is in ``store``; return a status line.

    ``explicit_source`` is the spec's ``$<source_env>`` (``None`` when unset).
    The key rule: only an *explicit* source tree may overwrite a published
    bundle — without one, an existing bundle is reused as-is rather than rebuilt
    from a default slice. See the module docstring for the full matrix.
    """
    if explicit_source is None and store.has_bundle(spec.provider, spec.version):
        return f"using existing {spec.provider}/{spec.version} bundle in the object store (no {spec.source_env} set)"

    source_dir = Path(explicit_source) if explicit_source else spec.default_root
    bundle = _build_from_local_source(spec, source_dir)
    if bundle is not None:
        store.put_bundle(bundle)
        return f"uploaded {spec.provider}/{spec.version} bundle ({len(bundle.records)} stations) from {source_dir}"

    if store.has_bundle(spec.provider, spec.version):
        return f"using existing {spec.provider}/{spec.version} bundle in the object store (no source at {source_dir})"

    if not spec.required:
        return f"skipped {spec.provider}/{spec.version}: no local source at {source_dir} and none published (optional)"

    raise SystemExit(
        f"No {spec.provider} source under {source_dir} and no bundle in the object store. "
        f"Supply the licensed source (see backend/seeds/climate/README.md) or set {spec.source_env}."
    )


def main() -> None:
    assert_local_dev_database()
    if not settings.r2_endpoint_url:
        raise SystemExit("R2_ENDPOINT_URL is required; start the object store with `make object-store-init`.")

    store = ClimateBundleStore.from_settings()
    for spec in _BOOTSTRAP_SPECS:
        print(ensure_bundle(store, spec, explicit_source=os.getenv(spec.source_env)))


def _build_from_local_source(spec: _BundleSpec, source_dir: Path) -> ClimateBundle | None:
    """Build the spec's bundle from the local tree, or None when it holds no stations.

    A parse failure (malformed file) still propagates — only an empty/absent
    source falls through to "use the existing bundle" / "skip".
    """
    try:
        return build_bundle(spec.provider, spec.version, source_dir)
    except EmptySourceError:
        return None


if __name__ == "__main__":
    main()
