"""Publish a licensed surface-film table to the private object store.

**The repo carries this loader; it must never carry the values.** ASHRAE
Fundamentals is licensed and this repo is public, so the operator supplies
the numbers from their own copy of the handbook and this script uploads
them (``context/DATA_STORAGE.md`` class ④, the same route as the licensed
climate bundles).

Write a small JSON file — anywhere outside the repo, or under the
gitignored ``backend/seeds/`` — shaped like::

    {
      "standard": "ashrae",
      "rsi_by_direction": {"upward": …, "horizontal": …, "downward": …},
      "rse_outdoor_air_m2k_w": …,
      "source": "ASHRAE Handbook — Fundamentals 2017, Ch. 26, Table 10"
    }

All values are SI (m²·K/W). ASHRAE tabulates surface *conductances* (h) in
W/(m²·K); the resistance is ``1/h``. Then::

    cd backend
    uv run python -m scripts.seed_surface_films --from ~/ashrae-films.json

Verify what is published with ``--show ashrae``.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, cast, get_args

from config import settings
from features.envelope.surface_film_store import (
    SurfaceFilmStore,
    SurfaceFilmTableUnavailableError,
    parse_surface_film_payload,
    surface_film_object_key,
)
from features.project_document.document import ThermalStandard

_PUBLISHABLE = tuple(standard for standard in get_args(ThermalStandard) if standard != "iso_6946")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--from", dest="source_path", type=Path, help="JSON file holding the operator's values.")
    parser.add_argument("--show", choices=_PUBLISHABLE, help="Print what is currently published for a standard.")
    args = parser.parse_args()

    if not settings.r2_endpoint_url:
        raise SystemExit("R2/MinIO is not configured; set the object-store settings before seeding.")
    store = SurfaceFilmStore.from_settings()

    if args.show:
        published = store.get(cast(ThermalStandard, args.show))
        if published is None:
            raise SystemExit(f"Nothing published at {surface_film_object_key(cast(ThermalStandard, args.show))}.")
        print(f"{published.standard}: Rsi={dict(published.rsi_by_direction)} Rse={published.rse_outdoor_air_m2k_w}")
        return

    if args.source_path is None:
        parser.error("one of --from or --show is required")
    key = _publish(store, args.source_path)
    print(f"Published {key}. Restart the API (or call reset_surface_film_cache) to pick it up.")


def _publish(store: SurfaceFilmStore, source_path: Path) -> str:
    if not source_path.is_file():
        raise SystemExit(f"No such file: {source_path}")
    payload = cast(dict[str, Any], json.loads(source_path.read_text(encoding="utf-8")))
    standard = payload.get("standard")
    if standard not in _PUBLISHABLE:
        raise SystemExit(f"'standard' must be one of {_PUBLISHABLE}; got {standard!r}.")
    source = payload.get("source")
    if not isinstance(source, str) or not source.strip():
        # Licensed data must carry its citation, so the next reader knows
        # which edition and table these numbers came from.
        raise SystemExit("'source' is required — cite the handbook edition and table.")

    # Reuse the store's own parser so a malformed file fails here, at the
    # operator's terminal, rather than at request time.
    try:
        table = parse_surface_film_payload(payload, cast(ThermalStandard, standard))
    except SurfaceFilmTableUnavailableError as error:
        raise SystemExit(str(error)) from error
    return store.put(table, source=source.strip())


if __name__ == "__main__":
    main()
