"""Importer for the Phius station ``-mon.txt`` files.

Phius ships its 2022 US climate set as 1007 tab-delimited station files
under ``USA/<STATE>/<STATION>-mon.txt`` (cp1252, CRLF, some German PHPP
labels). This module turns one file into a :class:`ClimateRecord` and
walks a directory tree to seed the whole ``phius`` reference dataset.

The real file shape (verified against all 1007 files):

- A packed **header row** crams the station name (first cell) plus
  label→value pairs for ``Latitude [°]`` / ``Longitude [°]`` /
  ``Height a.s.l. (m)`` / ``Daily temperature variation summer (K)`` and
  the three design-column headers, all on one tab-row.
- Eight **series rows** — ``Temperature outdoor`` / ``Dewpoint`` /
  ``Sky temperature`` / ``North`` / ``East`` / ``South`` / ``West`` /
  ``Global`` — each carrying 12 monthly values followed by three design
  columns (Heating-load-1 / Heating-load-2 / Cooling-load). The design
  columns are **numeric only** for temperature + the five radiation rows;
  the ``Dewpoint`` and ``Sky temperature`` design cells hold metadata
  (``4d`` = cold-day count, ``w1: 22/1`` = design dates), so those tails
  are skipped, not parsed.
- More **packed scalar rows** (degree-hours + Jan/Jul wind on one row;
  ``12-h Temperaturmin.`` + the two German summer-night-fraction labels
  on another) plus a free-text ``Albedo = 0.2`` line.

Country is always ``US`` (the set is US-only); the state/region comes
from the file's parent directory, not the file body. One file
(``DALLAS_LOVE_FIELD``) repeats the whole block twice — the first
occurrence of each series row wins.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from pathlib import Path

from features.climate.record import (
    ClimateAux,
    ClimateData,
    ClimateLocation,
    ClimateMonthlyRadiation,
    ClimateMonthlyTemps,
    ClimatePeakLoad,
    ClimatePeakLoads,
    ClimatePhppCodes,
    ClimateRecord,
)
from features.climate.service import SeedResult, seed_dataset

_ENCODING = "cp1252"
_MONTHS = 12
_COUNTRY = "US"
# Design columns trailing each series row, in file order. The Phius
# `-mon.txt` carries three (Heating 1 / Heating 2 / Cooling); the fourth
# honeybee_ph design condition (cooling_load_2) is left at its default.
_DESIGN_SLOTS = ("heat_load_1", "heat_load_2", "cooling_load_1")
_ALBEDO_RE = re.compile(r"albedo\s*=\s*([\d.]+)", re.IGNORECASE)
_NUMBER_RE = re.compile(r"-?\d+(?:\.\d+)?")


def _norm(label: str) -> str:
    """Normalize a label for tolerant matching.

    Lowercase, drop ``[...]`` / ``(...)`` unit suffixes, collapse
    whitespace, and trim a trailing period — so ``Height a.s.l. (m)``
    and ``Latitude [°]`` match on their stem regardless of unit wording.
    """
    stripped = re.sub(r"[\[(].*?[\])]", " ", label)
    return " ".join(stripped.strip().lower().split()).rstrip(".")


# Series rows: normalized label -> (monthly-target, peak-attribute). The
# monthly target names the ClimateRecord series the 12 values populate.
# The peak attribute names which ClimatePeakLoad field the (numeric)
# design columns feed; ``None`` means the design columns are metadata and
# are ignored (Dewpoint / Sky temperature).
_SERIES_FIELDS: dict[str, tuple[str, str | None]] = {
    "temperature outdoor": ("air_c", "temp_c"),
    "dewpoint": ("dewpoint_c", None),
    "sky temperature": ("sky_c", None),
    "north": ("north", "rad_north"),
    "east": ("east", "rad_east"),
    "south": ("south", "rad_south"),
    "west": ("west", "rad_west"),
    "global": ("glob", "rad_global"),
}

# Packed scalar labels: normalized label -> attribute key. Values are
# read by scanning each row for these labels and taking the next
# non-empty cell (the rows interleave several label/value pairs).
_SCALARS = {
    "latitude": "latitude",
    "longitude": "longitude",
    "height a.s.l": "station_elevation_m",
    "daily temperature variation summer": "swing_k",
    "heating degree-hours": "heating_degree_hours_12_20",
    "cooling degree-hours": "cooling_degree_hours_24",
    "jan": "wind_speed_jan_ms",
    "jul": "wind_speed_jul_ms",
    "12-h temperaturmin": "temp_min_12h_c",
}


class PhiusParseError(ValueError):
    """Raised when a ``-mon.txt`` file does not match the expected shape."""


def parse_phius_mon_txt(text: str, *, station_id: str, region: str = "") -> ClimateRecord:
    """Parse one Phius ``-mon.txt`` body into a standardized record.

    ``region`` is the US state code (from the file's directory); the file
    body carries no country/region of its own.
    """
    scalars: dict[str, str] = {}
    series: dict[str, list[float]] = {}
    designs: dict[str, list[float]] = {}
    name = ""

    for raw_line in text.splitlines():
        cells = raw_line.split("\t")
        label = _norm(cells[0])

        if label in _SERIES_FIELDS:
            monthly_key, peak_attr = _SERIES_FIELDS[label]
            if monthly_key in series:
                continue  # duplicated block (e.g. DALLAS_LOVE_FIELD) — first wins
            values = [cell.strip() for cell in cells[1:] if cell.strip() != ""]
            if len(values) < _MONTHS:
                raise PhiusParseError(f"Series '{label}' has {len(values)} values, need ≥{_MONTHS}.")
            series[monthly_key] = [_to_float(v, label) for v in values[:_MONTHS]]
            if peak_attr is not None:
                designs[peak_attr] = [_to_float(v, label) for v in values[_MONTHS:]]
            continue

        if cells[0].strip() and not name:
            name = cells[0].strip()  # first non-empty leading cell is the station name
        _scan_scalars(cells, scalars)

    scalars.setdefault("name", name or station_id)
    albedo = _ALBEDO_RE.search(text)
    if albedo is not None:
        scalars["albedo"] = albedo.group(1)

    return _assemble_record(scalars, series, designs, station_id=station_id, region=region)


def _scan_scalars(cells: list[str], scalars: dict[str, str]) -> None:
    """Pull label/value pairs out of one packed row into ``scalars``.

    For each cell matching a known scalar label, the next non-empty cell
    is its value; the German summer-night-fraction labels are matched by
    their ``g/kg`` humidity threshold rather than full text.
    """
    for index, cell in enumerate(cells):
        normalized = _norm(cell)
        if normalized in _SCALARS:
            key = _SCALARS[normalized]
        elif "g/kg" in cell:
            key = "summer_night_fraction_humid_pct" if "> 14" in cell else "summer_night_fraction_dry_pct"
        else:
            continue
        if key in scalars:
            continue  # first occurrence wins
        value = _next_value(cells, index)
        if value is not None:
            scalars[key] = value


def _next_value(cells: list[str], index: int) -> str | None:
    """The next non-empty cell after ``index``, or None."""
    for cell in cells[index + 1 :]:
        if cell.strip() != "":
            return cell.strip()
    return None


def parse_phius_mon_file(path: Path) -> ClimateRecord:
    """Parse a Phius ``-mon.txt`` file, deriving station id + region from its path."""
    station_id = path.name.removesuffix("-mon.txt")
    return parse_phius_mon_txt(
        path.read_text(encoding=_ENCODING),
        station_id=station_id,
        region=path.parent.name,
    )


def iter_phius_records(root: Path) -> Iterator[ClimateRecord]:
    """Yield a record for every ``*-mon.txt`` under ``root`` (sorted, stable)."""
    for path in sorted(root.rglob("*-mon.txt")):
        yield parse_phius_mon_file(path)


def seed_phius_dataset(root: Path, *, version: str = "2022", replace: bool = True) -> SeedResult:
    """Parse every station under ``root`` and seed the ``phius`` dataset."""
    return seed_dataset(
        "phius",
        version,
        iter_phius_records(root),
        label=f"Phius {version}",
        source="Phius monthly climate data (-mon.txt)",
        replace=replace,
    )


def _assemble_record(
    scalars: dict[str, str],
    series: dict[str, list[float]],
    designs: dict[str, list[float]],
    *,
    station_id: str,
    region: str,
) -> ClimateRecord:
    for required in ("air_c", "north", "glob"):
        if required not in series:
            raise PhiusParseError(f"Missing required series for '{required}'.")

    longitude = _require_float(scalars, "longitude")
    name = scalars.get("name", station_id)

    return ClimateRecord(
        display_name=name,
        provider="phius",
        version=None,  # set by the seed routine via the dataset row
        station_id=station_id,
        phpp_codes=ClimatePhppCodes(country_code=_COUNTRY, region_code=region, dataset_name=name),
        location=ClimateLocation(
            latitude=_require_float(scalars, "latitude"),
            longitude=longitude,
            site_elevation_m=_scalar_float(scalars, "station_elevation_m"),
            hours_from_utc=round(longitude / 15.0),
        ),
        climate=ClimateData(
            station_elevation_m=_scalar_float(scalars, "station_elevation_m") or 0.0,
            summer_daily_temperature_swing_k=_scalar_float(scalars, "swing_k") or 8.0,
            average_wind_speed_ms=_average_wind(scalars),
            monthly_temps=ClimateMonthlyTemps(
                air_c=series["air_c"],
                dewpoint_c=series.get("dewpoint_c", [0.0] * _MONTHS),
                sky_c=series.get("sky_c", [0.0] * _MONTHS),
                ground_c=[0.0] * _MONTHS,  # Phius -mon.txt carries no monthly ground temps
            ),
            monthly_radiation=ClimateMonthlyRadiation(
                north=series["north"],
                east=series.get("east", [0.0] * _MONTHS),
                south=series.get("south", [0.0] * _MONTHS),
                west=series.get("west", [0.0] * _MONTHS),
                glob=series["glob"],
            ),
            peak_loads=_assemble_peaks(designs),
        ),
        aux=ClimateAux(
            heating_degree_hours_12_20=_scalar_float(scalars, "heating_degree_hours_12_20"),
            cooling_degree_hours_24=_scalar_float(scalars, "cooling_degree_hours_24"),
            wind_speed_jan_ms=_scalar_float(scalars, "wind_speed_jan_ms"),
            wind_speed_jul_ms=_scalar_float(scalars, "wind_speed_jul_ms"),
            temp_min_12h_c=_scalar_float(scalars, "temp_min_12h_c"),
            summer_night_fraction_dry_pct=_scalar_float(scalars, "summer_night_fraction_dry_pct"),
            summer_night_fraction_humid_pct=_scalar_float(scalars, "summer_night_fraction_humid_pct"),
            albedo=_scalar_float(scalars, "albedo"),
        ),
    )


def _average_wind(scalars: dict[str, str]) -> float:
    """Mean of the Jan/Jul design winds (the file has no single annual value)."""
    winds = [
        wind
        for wind in (_scalar_float(scalars, "wind_speed_jan_ms"), _scalar_float(scalars, "wind_speed_jul_ms"))
        if wind is not None
    ]
    return sum(winds) / len(winds) if winds else 4.0


def _assemble_peaks(designs: dict[str, list[float]]) -> ClimatePeakLoads:
    """Distribute each series' trailing design columns into the peak loads.

    ``designs[attr]`` is the list of design-column values for one peak
    attribute (e.g. ``rad_north``), ordered Heating-1 / Heating-2 /
    Cooling. We pivot that into one ``ClimatePeakLoad`` per design slot.
    """
    loads = {slot: _build_peak(designs, index) for index, slot in enumerate(_DESIGN_SLOTS)}
    return ClimatePeakLoads(**loads)


def _build_peak(designs: dict[str, list[float]], index: int) -> ClimatePeakLoad:
    """Assemble one design condition from the ``index``-th design column."""
    return ClimatePeakLoad(
        temp_c=_design_value(designs, "temp_c", index),
        rad_north=_design_value(designs, "rad_north", index),
        rad_east=_design_value(designs, "rad_east", index),
        rad_south=_design_value(designs, "rad_south", index),
        rad_west=_design_value(designs, "rad_west", index),
        rad_global=_design_value(designs, "rad_global", index),
    )


def _design_value(designs: dict[str, list[float]], attr: str, index: int) -> float:
    """The ``index``-th design value for ``attr``, or 0.0 when absent."""
    values = designs.get(attr, [])
    return values[index] if index < len(values) else 0.0


def _to_float(value: str, label: str) -> float:
    try:
        return float(value)
    except ValueError as exc:
        raise PhiusParseError(f"Non-numeric value '{value}' in series '{label}'.") from exc


def _scalar_float(scalars: dict[str, str], key: str) -> float | None:
    """First numeric token in ``scalars[key]`` (units like ``°C`` / ``%`` are tolerated)."""
    raw = scalars.get(key)
    if raw is None:
        return None
    match = _NUMBER_RE.search(raw)
    if match is None:
        raise PhiusParseError(f"Non-numeric scalar '{key}'='{raw}'.")
    return float(match.group())


def _require_float(scalars: dict[str, str], key: str) -> float:
    value = _scalar_float(scalars, key)
    if value is None:
        raise PhiusParseError(f"Missing required scalar '{key}'.")
    return value
