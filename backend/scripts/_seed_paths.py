"""Shared paths and defaults for the local-dev seed scripts.

Every seed script resolves its data file under `backend/seeds/`. Keeping
the paths in one place means `backend/seeds/` stays the single source of
truth — moving the directory (or splitting a file) is one edit, not five.

`default_user_kwargs()` reads `backend/seeds/user.json` so the editor
account stays consistent across scripts. Each script may still accept
`--email/--password/--display-name` to override.
"""

from __future__ import annotations

import json
import pathlib
from typing import Final

SEEDS_DIR: Final[pathlib.Path] = pathlib.Path(__file__).resolve().parent.parent / "seeds"
CATALOGS_DIR: Final[pathlib.Path] = SEEDS_DIR / "catalogs"
PROJECT_DIR: Final[pathlib.Path] = SEEDS_DIR / "project"

USER_SEED_PATH: Final[pathlib.Path] = SEEDS_DIR / "user.json"
MATERIALS_SEED_PATH: Final[pathlib.Path] = CATALOGS_DIR / "materials.v1.json"
GLAZING_SEED_PATH: Final[pathlib.Path] = CATALOGS_DIR / "glazing-types.v1.json"
FRAME_SEED_PATH: Final[pathlib.Path] = CATALOGS_DIR / "frame-types.v1.json"

PROJECT_META_PATH: Final[pathlib.Path] = PROJECT_DIR / "project.json"
ROOMS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "rooms.json"
PUMPS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "pumps.json"
FANS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "fans.json"
VENTILATORS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "ventilators.json"
HOT_WATER_TANKS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "hot-water-tanks.json"
ELECTRIC_HEATERS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "electric-heaters.json"
APPLIANCES_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "appliances.json"


def default_user_kwargs() -> dict[str, str]:
    """Return `{email, display_name, password}` from `seeds/user.json`."""
    return json.loads(USER_SEED_PATH.read_text())
