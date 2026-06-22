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
from urllib.parse import urlparse

from config import settings

# Every reset/reseed script guards on these before touching data, so a stray
# `ENVIRONMENT` or `DATABASE_URL` can never wipe a non-dev database.
LOCAL_ENVIRONMENTS: Final[frozenset[str]] = frozenset({"development", "test", "local"})
_LOCAL_DEV_DB_NAME: Final[str] = "ph_navigator_v2"

SEEDS_DIR: Final[pathlib.Path] = pathlib.Path(__file__).resolve().parent.parent / "seeds"
CATALOGS_DIR: Final[pathlib.Path] = SEEDS_DIR / "catalogs"
PROJECT_DIR: Final[pathlib.Path] = SEEDS_DIR / "project"
# Phius `-mon.txt` station tree (root for the importer walk) + the
# example HBJSON model. Both ride along in `backend/seeds/` so the climate
# and Model-tab features have something to show after a fresh reseed.
CLIMATE_DIR: Final[pathlib.Path] = SEEDS_DIR / "climate"
MODEL_DIR: Final[pathlib.Path] = SEEDS_DIR / "model"

USER_SEED_PATH: Final[pathlib.Path] = SEEDS_DIR / "user.json"
MATERIALS_SEED_PATH: Final[pathlib.Path] = CATALOGS_DIR / "materials.v1.json"
GLAZING_SEED_PATH: Final[pathlib.Path] = CATALOGS_DIR / "glazing-types.v1.json"
FRAME_SEED_PATH: Final[pathlib.Path] = CATALOGS_DIR / "frame-types.v1.json"

PROJECT_META_PATH: Final[pathlib.Path] = PROJECT_DIR / "project.json"
ASSEMBLIES_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "assemblies.json"
APERTURES_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "apertures.json"
ROOMS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "rooms.json"
SPACE_TYPES_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "space-types.json"
PUMPS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "pumps.json"
FANS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "fans.json"
THERMAL_BRIDGES_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "thermal-bridges.json"
VENTILATORS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "ventilators.json"
HOT_WATER_HEATERS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "hot-water-heaters.json"
HOT_WATER_TANKS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "hot-water-tanks.json"
ELECTRIC_HEATERS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "electric-heaters.json"
APPLIANCES_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "appliances.json"
HEAT_PUMPS_SEED_PATH: Final[pathlib.Path] = PROJECT_DIR / "heat-pumps.json"

# Climate / Model-tab seed sources. Phius ships a `-mon.txt` tree (the climate
# dir root); PHI ships a single licensed `.xlsx` the importer finds by walking a
# directory, so its default source is a dedicated `phi/` subdir (gitignored like
# the rest of `seeds/climate/`). Both are overridable via env (see
# `scripts.seed_climate_bundle`).
CLIMATE_PHIUS_ROOT: Final[pathlib.Path] = CLIMATE_DIR
CLIMATE_PHI_ROOT: Final[pathlib.Path] = CLIMATE_DIR / "phi"
HBJSON_SEED_PATH: Final[pathlib.Path] = MODEL_DIR / "ph_nav_v2_example.hbjson"

# Station id (filename minus `-mon.txt`) the starter project pins as its
# default climate source — the firm's home turf, NYC / Central Park.
CLIMATE_DEFAULT_STATION_ID: Final[str] = "NEW_YORK_CENTRAL_PRK_OBS_BELV_NY"


def default_user_kwargs() -> dict[str, str]:
    """Return `{email, display_name, password}` from `seeds/user.json`."""
    return json.loads(USER_SEED_PATH.read_text())


def assert_local_dev_database() -> None:
    """Refuse to seed anything but the local dev database.

    Shared safety guard for every reset/reseed script: bails unless
    `ENVIRONMENT` is local/dev/test and `DATABASE_URL` points at the
    `ph_navigator_v2` dev database.
    """
    if settings.environment not in LOCAL_ENVIRONMENTS:
        raise SystemExit(f"Refusing to seed ENVIRONMENT={settings.environment!r}; expected local/dev/test.")
    db_name = urlparse(settings.database_url).path.lstrip("/")
    if db_name != _LOCAL_DEV_DB_NAME:
        raise SystemExit(f"Refusing to reset database {db_name!r}; expected local dev database {_LOCAL_DEV_DB_NAME!r}.")
