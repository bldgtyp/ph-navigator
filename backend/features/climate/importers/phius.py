"""Importer for the Phius station ``-mon.txt`` files.

Phius ships its 2022 US climate set as ~1007 tab-delimited station files
under ``USA/<STATE>/<STATION>-mon.txt`` (cp1252-ish, some German PHPP
labels). Each file is the PHPP monthly climate shape: a header block of
scalars plus a set of 12-month series rows, each ending in three design
columns (Heating-load-1 / Heating-load-2 / Cooling-load). This module
turns one file into a :class:`ClimateRecord` and walks a directory tree
to seed the whole ``phius`` reference dataset.

REVALIDATION NOTE — this parser was authored against the documented
shape in ``planning/features/climate/research.md`` and the golden fixture
in ``tests/fixtures/climate/phius/`` because Ed's real Phius files are
gitignored and not yet in hand. The exact source labels (and any
cp1252 degree-symbol mojibake / German wording) must be reconciled with
the real files before the production seed — the label→field mapping is
deliberately centralized in :data:`_SERIES_FIELDS` and :data:`_SCALARS`
so that reconciliation is a one-place edit, not a rewrite.
"""

from __future__ import annotations

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
# Design columns trailing each series row, in file order. The Phius
# `-mon.txt` carries three (Heating 1 / Heating 2 / Cooling); the fourth
# honeybee_ph design condition (cooling_load_2) is left at its default.
_DESIGN_SLOTS = ("heat_load_1", "heat_load_2", "cooling_load_1")


def _norm(label: str) -> str:
    """Normalize a row label for tolerant matching (case/space-insensitive)."""
    return " ".join(label.strip().lower().split())


# Series rows: normalized label -> (monthly-target, peak-attribute). The
# monthly target names the ClimateRecord series the 12 values populate;
# the peak attribute names which ClimatePeakLoad field each design column
# feeds.
_SERIES_FIELDS: dict[str, tuple[str, str]] = {
    "temperature outdoor": ("air_c", "temp_c"),
    "dewpoint": ("dewpoint_c", "dewpoint_c"),
    "sky temperature": ("sky_c", "sky_c"),
    "radiation north": ("north", "rad_north"),
    "radiation east": ("east", "rad_east"),
    "radiation south": ("south", "rad_south"),
    "radiation west": ("west", "rad_west"),
    "radiation global": ("glob", "rad_global"),
}

# Scalar header rows: normalized label -> attribute key consumed below.
_SCALARS = {
    "name": "name",
    "country code": "country_code",
    "region code": "region_code",
    "latitude": "latitude",
    "longitude": "longitude",
    "height a.s.l. (m)": "station_elevation_m",
    "climate zone": "climate_zone",
    "daily temperature variation summer (k)": "swing_k",
    "average wind speed (m/s)": "avg_wind_ms",
    "heating degree-hours (12/20)": "heating_degree_hours_12_20",
    "cooling degree-hours (24)": "cooling_degree_hours_24",
    "wind speed jan (m/s)": "wind_speed_jan_ms",
    "wind speed jul (m/s)": "wind_speed_jul_ms",
    "12-h temperature min (c)": "temp_min_12h_c",
    "summer night fraction dry (%)": "summer_night_fraction_dry_pct",
    "summer night fraction humid (%)": "summer_night_fraction_humid_pct",
    "albedo": "albedo",
}


class PhiusParseError(ValueError):
    """Raised when a ``-mon.txt`` file does not match the expected shape."""


def parse_phius_mon_txt(text: str, *, station_id: str) -> ClimateRecord:
    """Parse one Phius ``-mon.txt`` body into a standardized record."""
    scalars: dict[str, str] = {}
    series: dict[str, list[float]] = {}
    designs: dict[str, list[float]] = {}

    for raw_line in text.splitlines():
        if not raw_line.strip():
            continue
        cells = raw_line.split("\t")
        label = _norm(cells[0])
        values = [cell.strip() for cell in cells[1:] if cell.strip() != ""]
        if label in _SERIES_FIELDS:
            numbers = [_to_float(v, label) for v in values]
            if len(numbers) < _MONTHS:
                raise PhiusParseError(f"Series '{label}' has {len(numbers)} values, need ≥{_MONTHS}.")
            monthly_key, peak_attr = _SERIES_FIELDS[label]
            series[monthly_key] = numbers[:_MONTHS]
            designs[peak_attr] = numbers[_MONTHS:]
        elif label in _SCALARS and values:
            scalars[_SCALARS[label]] = values[0]

    return _assemble_record(scalars, series, designs, station_id=station_id)


def parse_phius_mon_file(path: Path) -> ClimateRecord:
    """Parse a Phius ``-mon.txt`` file, deriving the station id from its name."""
    station_id = path.name.removesuffix("-mon.txt")
    return parse_phius_mon_txt(path.read_text(encoding=_ENCODING), station_id=station_id)


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
) -> ClimateRecord:
    for required in ("air_c", "north", "glob"):
        if required not in series:
            raise PhiusParseError(f"Missing required series for '{required}'.")

    longitude = _require_float(scalars, "longitude")
    avg_wind = _scalar_float(scalars, "avg_wind_ms")
    if avg_wind is None:
        winds = [
            w
            for w in (_scalar_float(scalars, "wind_speed_jan_ms"), _scalar_float(scalars, "wind_speed_jul_ms"))
            if w is not None
        ]
        avg_wind = sum(winds) / len(winds) if winds else 4.0

    return ClimateRecord(
        display_name=scalars.get("name", station_id),
        provider="phius",
        version=None,  # set by the seed routine via the dataset row
        station_id=station_id,
        phpp_codes=ClimatePhppCodes(
            country_code=scalars.get("country_code", "US-United States of America"),
            region_code=scalars.get("region_code", ""),
            dataset_name=scalars.get("name", station_id),
        ),
        location=ClimateLocation(
            latitude=_require_float(scalars, "latitude"),
            longitude=longitude,
            site_elevation_m=_scalar_float(scalars, "station_elevation_m"),
            climate_zone=int(float(scalars["climate_zone"])) if "climate_zone" in scalars else 1,
            hours_from_utc=round(longitude / 15.0),
        ),
        climate=ClimateData(
            station_elevation_m=_scalar_float(scalars, "station_elevation_m") or 0.0,
            summer_daily_temperature_swing_k=_scalar_float(scalars, "swing_k") or 8.0,
            average_wind_speed_ms=avg_wind,
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
        dewpoint_c=_design_value_opt(designs, "dewpoint_c", index),
        sky_c=_design_value_opt(designs, "sky_c", index),
    )


def _design_value(designs: dict[str, list[float]], attr: str, index: int) -> float:
    """The ``index``-th design value for ``attr``, or 0.0 when absent (required fields)."""
    values = designs.get(attr, [])
    return values[index] if index < len(values) else 0.0


def _design_value_opt(designs: dict[str, list[float]], attr: str, index: int) -> float | None:
    """The ``index``-th design value for ``attr``, or None when absent (optional fields)."""
    values = designs.get(attr, [])
    return values[index] if index < len(values) else None


def _to_float(value: str, label: str) -> float:
    try:
        return float(value)
    except ValueError as exc:
        raise PhiusParseError(f"Non-numeric value '{value}' in series '{label}'.") from exc


def _scalar_float(scalars: dict[str, str], key: str) -> float | None:
    raw = scalars.get(key)
    if raw is None or raw == "":
        return None
    try:
        return float(raw)
    except ValueError as exc:
        raise PhiusParseError(f"Non-numeric scalar '{key}'='{raw}'.") from exc


def _require_float(scalars: dict[str, str], key: str) -> float:
    value = _scalar_float(scalars, key)
    if value is None:
        raise PhiusParseError(f"Missing required scalar '{key}'.")
    return value
