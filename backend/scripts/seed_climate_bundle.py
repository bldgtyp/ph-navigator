"""Ensure the object store holds the Phius climate bundle for dev seeding.

The dev DB seed (:mod:`scripts.seed_dev_db`) pulls the standardized climate
bundle from the object store (PRD D-CS-2), but a fresh MinIO starts empty —
the same bootstrap role :mod:`scripts.init_object_store` plays for the
attachment bucket. This script (re)builds the ``phius/2022`` bundle from the
operator's local raw ``-mon.txt`` tree and uploads it.

    make object-store-init
    cd backend && uv run python -m scripts.seed_climate_bundle

Source tree: ``$CLIMATE_SOURCE_DIR`` if set, else ``backend/seeds/climate/``
(licensed data, gitignored — the operator supplies it; see
``backend/seeds/climate/README.md``). Behavior:

- local source present  → build + upload (refresh the bundle);
- no source, bundle already in the store → no-op (resets keep working without
  re-supplying the raw files);
- neither → fail loudly.
"""

from __future__ import annotations

import os
from pathlib import Path

from config import settings
from features.climate.bundle import ClimateBundle
from features.climate.object_store import ClimateBundleStore
from features.climate.processing import EmptySourceError, build_bundle
from scripts._seed_paths import CLIMATE_PHIUS_ROOT, assert_local_dev_database

# The dev bundle this script bootstraps. Other (provider, version) releases are
# published with the admin `python -m features.climate.processing` CLI.
_PROVIDER = "phius"
_VERSION = "2022"


def main() -> None:
    assert_local_dev_database()
    if not settings.r2_endpoint_url:
        raise SystemExit("R2_ENDPOINT_URL is required; start the object store with `make object-store-init`.")

    store = ClimateBundleStore.from_settings()
    source_dir = _source_dir()

    bundle = _build_from_local_source(source_dir)
    if bundle is not None:
        store.put_bundle(bundle)
        print(f"uploaded {_PROVIDER}/{_VERSION} bundle ({len(bundle.records)} stations) from {source_dir}")
        return

    if store.has_bundle(_PROVIDER, _VERSION):
        print(f"using existing {_PROVIDER}/{_VERSION} bundle in the object store (no local source at {source_dir})")
        return

    raise SystemExit(
        f"No Phius source under {source_dir} and no bundle in the object store. "
        "Supply the licensed -mon.txt tree (see backend/seeds/climate/README.md) or set CLIMATE_SOURCE_DIR."
    )


def _source_dir() -> Path:
    override = os.getenv("CLIMATE_SOURCE_DIR")
    return Path(override) if override else CLIMATE_PHIUS_ROOT


def _build_from_local_source(source_dir: Path) -> ClimateBundle | None:
    """Build the bundle from the local tree, or None when it holds no stations.

    A parse failure (malformed file) still propagates — only an empty/absent
    source falls through to "use the existing bundle".
    """
    try:
        return build_bundle(_PROVIDER, _VERSION, source_dir)
    except EmptySourceError:
        return None


if __name__ == "__main__":
    main()
