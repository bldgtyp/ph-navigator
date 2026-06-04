"""One-shot CSV → JSON seed-file builder for the Materials Catalog.

Reads `research/Material Data-Grid view.csv`, the canonical real-world
dataset exported from WUFI / manufacturer datasheets, and emits a
v1 catalog-import file at `working/materials-seed.json`.

This is NOT the production import path. It exists so Phase 4
verification can round-trip a realistic dataset (~400 rows) through
the `POST /api/v1/catalogs/materials/import/{preview,commit}`
endpoints. CSV mapping decisions live here, not in the app:

- CSV `category` labels (e.g. "Stud_Layers_Stl",
  "Air: Horiz. Heatflow") are translated to the twelve canonical
  option ids the backend's CHECK constraint enforces. The runtime
  `_CATEGORY_LABEL_TO_ID` map only knows the labels the frontend
  overlay actually ships, so legacy WUFI labels need this layer.
- `ARGB_COLOR` "a,r,g,b" tuples are converted to `#rrggbb`; alpha is
  dropped (backend's coerce step would also accept the tuple form,
  but conversion here keeps the seed file canonical).
- Audit columns (`display_name`, `DATASHEET`,
  `conductivity_btu_hr_ft_F`, `resistivity_hr_ft2_F_Btu_in`) are
  not part of the catalog contract and are dropped.

Run from the repo root:
    uv run --no-project python research/build_materials_seed.py

(or any python ≥ 3.10 with stdlib only — no third-party deps).
"""

from __future__ import annotations

import csv
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INPUT_CSV = REPO_ROOT / "research" / "Material Data-Grid view.csv"
OUTPUT_JSON = REPO_ROOT / "working" / "materials-seed.json"

# Verbatim from the CSV → canonical option id. Anything not in this
# map ends up with `category` set to None and the importer would mark
# the row errored (missing_category) — flag those at conversion time
# so the seed is clean.
CATEGORY_MAP: dict[str, str] = {
    "Insulations": "insulation",
    "Finishes": "finishes",
    "Woods": "woods",
    "Metals": "metals",
    "Masonry": "masonry",
    "Stud_Layers_Stl": "stud_layers_steel",
    "Stud_Layers_Wd": "stud_layers_wood",
    "Air: Horiz. Heatflow": "air_horizontal_heat_flow",
    "Air: Upward Heatflow": "air_upward_heat_flow",
    "Air: Downward Heatflow": "air_downward_heat_flow",
    "Rainscreen Insulation": "rainscreen_insulation",
    "Doors": "doors",
}

# Drift guard mirroring `coerce.py`'s assertion on the runtime label
# map. If a future PR adds a thirteenth category id to the backend
# without extending CATEGORY_MAP, the seed run fails fast at startup
# instead of silently dumping rows into the unmapped-categories
# stderr bucket. Hand-copied so this script keeps stdlib-only.
_EXPECTED_CATEGORY_IDS: set[str] = {
    "insulation",
    "finishes",
    "woods",
    "metals",
    "masonry",
    "stud_layers_steel",
    "stud_layers_wood",
    "air_horizontal_heat_flow",
    "air_upward_heat_flow",
    "air_downward_heat_flow",
    "rainscreen_insulation",
    "doors",
}
assert set(CATEGORY_MAP.values()) == _EXPECTED_CATEGORY_IDS, (
    "CATEGORY_MAP drifted from the backend's MATERIAL_CATEGORY_IDS — "
    "update build_materials_seed.py (and _EXPECTED_CATEGORY_IDS) to "
    "match `backend/features/catalogs/materials/models.py`."
)


def coerce_number(raw: str) -> float | None:
    raw = raw.strip()
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def coerce_color(raw: str) -> str | None:
    """ARGB tuple `a,r,g,b` → `#rrggbb`; drop alpha. Blank → None."""
    raw = raw.strip()
    if not raw:
        return None
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) != 4:
        return None
    try:
        a, r, g, b = (int(p) for p in parts)
    except ValueError:
        return None
    if a == 0:
        # Phase 2 review: alpha=0 is the legacy "no color" sentinel.
        return None
    if not all(0 <= c <= 255 for c in (r, g, b)):
        return None
    return f"#{r:02x}{g:02x}{b:02x}"


def coerce_text(raw: str) -> str | None:
    stripped = raw.strip()
    return stripped or None


def build() -> dict[str, object]:
    rows_out: list[dict[str, object]] = []
    unknown_categories: dict[str, int] = {}
    with INPUT_CSV.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for raw in reader:
            csv_category = raw.get("category", "").strip()
            category = CATEGORY_MAP.get(csv_category)
            if category is None:
                unknown_categories[csv_category] = unknown_categories.get(csv_category, 0) + 1
                continue  # skip — would be errored by the importer
            rows_out.append(
                {
                    "name": coerce_text(raw.get("name", "")),
                    "category": category,
                    "density_kg_m3": coerce_number(raw.get("density_kg_m3", "")),
                    "specific_heat_j_kgk": coerce_number(raw.get("specific_heat_capacity_J_kg_K", "")),
                    "conductivity_w_mk": coerce_number(raw.get("conductivity_w_mk", "")),
                    "emissivity": coerce_number(raw.get("emissivity", "")),
                    "color": coerce_color(raw.get("ARGB_COLOR", "")),
                    "source": coerce_text(raw.get("source", "")),
                    "url": None,
                    "comments": coerce_text(raw.get("comments", "")),
                }
            )

    if unknown_categories:
        print("WARNING — CSV rows with unmapped category were skipped:", file=sys.stderr)
        for label, n in sorted(unknown_categories.items()):
            print(f"  {n:4d}  {label!r}", file=sys.stderr)

    return {
        "kind": "ph-navigator.catalog.materials",
        "schema_version": 1,
        "exported_at": datetime.now(tz=UTC).isoformat().replace("+00:00", "Z"),
        "exported_by": "research/build_materials_seed.py",
        "app_version": None,
        "rows": rows_out,
    }


def main() -> None:
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    file_dict = build()
    OUTPUT_JSON.write_text(json.dumps(file_dict, indent=2) + "\n", encoding="utf-8")
    rows = file_dict["rows"]
    assert isinstance(rows, list)
    print(f"Wrote {OUTPUT_JSON.relative_to(REPO_ROOT)} with {len(rows)} rows.")


if __name__ == "__main__":
    main()
