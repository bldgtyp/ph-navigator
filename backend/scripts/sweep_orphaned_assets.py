"""Manual asset GC sweeper.

Dry-run is the default. Use ``--apply`` only after inspecting the candidate
list; the first implementation moves objects to the R2 ``_orphaned/`` prefix
and relies on bucket lifecycle for eventual deletion.
"""

from __future__ import annotations

import argparse
import json
from uuid import UUID

from config import settings
from features.assets.service import AssetService
from features.assets.storage_r2 import R2Client
from features.assets.thumbnailer import Thumbnailer


def main() -> None:
    parser = argparse.ArgumentParser(description="Move unreferenced project assets to the R2 orphan prefix.")
    parser.add_argument("project_id", type=UUID)
    parser.add_argument("--apply", action="store_true", help="Move objects instead of reporting a dry-run.")
    parser.add_argument("--pending-max-age-hours", type=int, default=24)
    args = parser.parse_args()

    r2 = R2Client(settings)
    service = AssetService(r2=r2, thumbnailer=Thumbnailer(r2))
    result = service.sweep_orphaned_assets(
        args.project_id,
        dry_run=not args.apply,
        pending_max_age_hours=args.pending_max_age_hours,
    )
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
