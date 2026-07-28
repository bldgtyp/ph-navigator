"""Load the canonical frame-types seed JSON into the local catalog.

Reads the committed `backend/seeds/catalogs/frame-types.v1.json` envelope
and pipes it through the same preview → commit pipeline the HTTP routes
use. Every committed row carries a deterministic id, so repeated runs
insert only missing rows and never update existing ones.
"""

from __future__ import annotations

from features.catalogs.frame_types.import_export.service import commit_import, preview_import
from scripts._catalog_seed import CatalogSeedSpec, run_catalog_seed
from scripts._seed_paths import FRAME_SEED_PATH

DEFAULT_SEED_PATH = FRAME_SEED_PATH
SEED_SPEC = CatalogSeedSpec(
    description="Seed the local frame-types catalog.",
    default_seed_path=DEFAULT_SEED_PATH,
    request_path="/scripts/seed_frame_catalog",
    user_agent="seed-frame-catalog",
    preview_import=preview_import,
    commit_import=commit_import,
)


def main() -> None:
    run_catalog_seed(SEED_SPEC)


if __name__ == "__main__":
    main()
