"""Ensure the object store holds the Phius climate bundle for dev seeding.

The dev DB seed (:mod:`scripts.seed_dev_db`) pulls the standardized climate
bundle from the object store (PRD D-CS-2), but a fresh MinIO starts empty —
the same bootstrap role :mod:`scripts.init_object_store` plays for the
attachment bucket. This script ensures the ``phius/2022`` bundle exists in the
store, building it from the operator's local raw ``-mon.txt`` tree when needed.

    make object-store-init
    cd backend && uv run python -m scripts.seed_climate_bundle

Behavior (``$CLIMATE_SOURCE_DIR`` is the operator's raw ``-mon.txt`` tree;
absent it defaults to ``backend/seeds/climate/``, the gitignored 24-station NY
slice — see ``backend/seeds/climate/README.md``):

- ``CLIMATE_SOURCE_DIR`` set        → (re)build from it and upload (the operator
  chose this tree, so publishing it — and replacing any existing bundle — is
  intended);
- no override, bundle already in the store → **reuse it** (never clobber a
  published bundle with the small default slice — this is what lets a plain
  ``make db-reset-dev`` keep the full library that was published once);
- no override, no bundle yet        → bootstrap-upload the default slice so a
  fresh dev still gets seedable data;
- nothing buildable and no bundle   → fail loudly.

To deliberately refresh the bundle from the default slice, set
``CLIMATE_SOURCE_DIR=backend/seeds/climate`` explicitly.
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


def ensure_bundle(store: ClimateBundleStore, *, explicit_source: str | None) -> str:
    """Ensure the ``phius/2022`` bundle is in ``store``; return a status line.

    ``explicit_source`` is ``$CLIMATE_SOURCE_DIR`` (``None`` when unset). The
    key rule: only an *explicit* source tree may overwrite a published bundle —
    without one, an existing bundle is reused as-is rather than rebuilt from the
    default 24-station slice. See the module docstring for the full matrix.
    """
    if explicit_source is None and store.has_bundle(_PROVIDER, _VERSION):
        return f"using existing {_PROVIDER}/{_VERSION} bundle in the object store (no CLIMATE_SOURCE_DIR set)"

    source_dir = Path(explicit_source) if explicit_source else CLIMATE_PHIUS_ROOT
    bundle = _build_from_local_source(source_dir)
    if bundle is not None:
        store.put_bundle(bundle)
        return f"uploaded {_PROVIDER}/{_VERSION} bundle ({len(bundle.records)} stations) from {source_dir}"

    if store.has_bundle(_PROVIDER, _VERSION):
        return f"using existing {_PROVIDER}/{_VERSION} bundle in the object store (no local source at {source_dir})"

    raise SystemExit(
        f"No Phius source under {source_dir} and no bundle in the object store. "
        "Supply the licensed -mon.txt tree (see backend/seeds/climate/README.md) or set CLIMATE_SOURCE_DIR."
    )


def main() -> None:
    assert_local_dev_database()
    if not settings.r2_endpoint_url:
        raise SystemExit("R2_ENDPOINT_URL is required; start the object store with `make object-store-init`.")

    print(ensure_bundle(ClimateBundleStore.from_settings(), explicit_source=os.getenv("CLIMATE_SOURCE_DIR")))


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
