"""Shared loaders for bundled project-location reference data."""

from __future__ import annotations

import csv
from functools import cache
from pathlib import Path

_COUNTY_REFERENCE_CSV = Path(__file__).with_name("data") / "climate_zones.csv"
_COUNTY_REFERENCE_COLUMNS = (
    "county_fips_5",
    "county_name",
    "state_name",
    "iecc_zone",
    "ba_zone",
)


@cache
def load_county_reference_rows() -> dict[str, dict[str, str]]:
    """Return county reference rows keyed by five-digit county FIPS."""
    with _COUNTY_REFERENCE_CSV.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if tuple(reader.fieldnames or ()) != _COUNTY_REFERENCE_COLUMNS:
            raise ValueError(f"Unexpected county reference columns: {reader.fieldnames!r}")
        rows = {row["county_fips_5"].zfill(5): row for row in reader if row.get("county_fips_5")}
    if any(not row.get("county_name") for row in rows.values()):
        raise ValueError("County reference row is missing county_name.")
    return rows
