"""Dependency-free EPW LOCATION header parsing."""

from __future__ import annotations

import csv
from io import StringIO

from features.project_location.models import EpwParsedLocation

EPW_HEADER_PREFIX_BYTES = 8192

_US_STATE_TIME_ZONES = {
    "AL": "America/Chicago",
    "AR": "America/Chicago",
    "CT": "America/New_York",
    "DC": "America/New_York",
    "DE": "America/New_York",
    "GA": "America/New_York",
    "IL": "America/Chicago",
    "IN": "America/Indiana/Indianapolis",
    "IA": "America/Chicago",
    "LA": "America/Chicago",
    "MA": "America/New_York",
    "MD": "America/New_York",
    "ME": "America/New_York",
    "MI": "America/Detroit",
    "MN": "America/Chicago",
    "MO": "America/Chicago",
    "MS": "America/Chicago",
    "NC": "America/New_York",
    "ND": "America/Chicago",
    "NH": "America/New_York",
    "NJ": "America/New_York",
    "NY": "America/New_York",
    "OH": "America/New_York",
    "OK": "America/Chicago",
    "PA": "America/New_York",
    "RI": "America/New_York",
    "SC": "America/New_York",
    "VT": "America/New_York",
    "WI": "America/Chicago",
}


def parse_epw_location_header(prefix: bytes) -> EpwParsedLocation:
    """Parse the EPW LOCATION record into a user-reviewable suggestion."""
    first_line = prefix.splitlines()[0].decode("utf-8-sig", errors="strict").strip() if prefix else ""
    try:
        row = next(csv.reader(StringIO(first_line)))
    except Exception as exc:
        raise ValueError("epw_location_header_invalid") from exc
    if len(row) < 10 or row[0] != "LOCATION":
        raise ValueError("epw_location_header_invalid")

    city, state, country, source, wmo = (clean_text(value) for value in row[1:6])
    latitude = parse_float(row[6], "latitude")
    longitude = parse_float(row[7], "longitude")
    offset_hours = parse_float(row[8], "time_zone")
    elevation_m = parse_float(row[9], "elevation")

    return EpwParsedLocation(
        latitude=latitude,
        longitude=longitude,
        elevation_m=elevation_m,
        time_zone=representative_time_zone(country=country, state=state, offset_hours=offset_hours),
        time_zone_offset_hours=offset_hours,
        city=city,
        state=state,
        country=country,
        source=source,
        wmo=wmo,
    )


def epw_header_looks_valid(prefix: bytes) -> bool:
    try:
        parse_epw_location_header(prefix)
    except ValueError:
        return False
    return True


def clean_text(value: str) -> str | None:
    text = value.strip()
    return text or None


def parse_float(value: str, field_name: str) -> float:
    try:
        return float(value.strip())
    except ValueError as exc:
        raise ValueError(f"epw_{field_name}_invalid") from exc


def representative_time_zone(*, country: str | None, state: str | None, offset_hours: float) -> str | None:
    if offset_hours == 0:
        return "UTC"
    if country in {"USA", "United States", "United States of America"} and state:
        return _US_STATE_TIME_ZONES.get(state.upper())
    return None
