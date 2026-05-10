# -*- Python Version: 3.11 -*-

# Spike-only routes (week 0, plan §3.3). Read CSV seed files directly and
# return JSON. No DB persistence — the spike is purely a UI feel test.
# These routes will be removed when the spike concludes.

import csv
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/catalog-poc/_spike", tags=["catalog-poc-spike"])

SEED_DIR = Path(__file__).resolve().parent / "poc_seeds" / "airtable_export"

# Columns that should be emitted as numbers when non-empty. Keep this list
# explicit rather than inferring — keeps the spike behavior predictable.
MATERIAL_NUMERIC_FIELDS = {
    "density_kg_m3",
    "specific_heat_capacity_J_kg_K",
    "conductivity_w_mk",
    "conductivity_btu_hr_ft_F",
    "resistivity_hr_ft2_F_Btu_in",
    "emissivity",
}


def _coerce(value: str, key: str) -> str | float | None:
    if value == "":
        return None
    if key in MATERIAL_NUMERIC_FIELDS:
        try:
            return float(value)
        except ValueError:
            return value
    return value


@router.get("/materials")
async def materials() -> dict:
    csv_path = SEED_DIR / "Material Data-Grid view.csv"
    if not csv_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Seed CSV not found at {csv_path}. See plan §2.",
        )
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = [
            {k: _coerce(v, k) for k, v in row.items()} for row in reader
        ]
    return {"count": len(rows), "rows": rows}
