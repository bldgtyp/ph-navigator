"""Parse the cacheable EnergyPlus `.stat` values used by Climate P3."""

from __future__ import annotations

import re

from features.climate.design_conditions import ClimateDesignConditions, EpwStatMetrics, ParsedStatPayload

_NUMBER_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")
_EDITION_RE = re.compile(r'from "([^"]+)"')
_WMO_RE = re.compile(r"\bWMO Station\s+(\d+)\b", re.IGNORECASE)


def parse_stat_file(text: str) -> ParsedStatPayload:
    """Extract degree-days, extremes, and annual design conditions."""
    lines = [line.rstrip() for line in text.replace("\ufeff", "").splitlines()]
    station_name = _station_name(lines)
    wmo = _match_first(_WMO_RE, lines)
    basis = _basis(lines)
    heating = _first_row(lines, "Heating")
    cooling = _first_row(lines, "Cooling")
    extremes = _first_row(lines, "Extremes")

    hdd65 = _annual_sum(_first_line(lines, "HDD base 18.3C"))
    cdd50 = _annual_sum(_first_line(lines, "CDD base 10C"))
    record_low = _value_at(extremes, 3)
    record_high = _value_at(extremes, 4)

    metrics_missing = _missing(
        {
            "hdd65_f_days": hdd65,
            "cdd50_f_days": cdd50,
            "record_low_c": record_low,
            "record_high_c": record_high,
        }
    )
    design_values = {
        "heating_996_db_c": _value_at(heating, 1),
        "heating_990_db_c": _value_at(heating, 2),
        "cooling_010_db_c": _value_at(cooling, 4),
        "cooling_010_mcwb_c": _value_at(cooling, 5),
        "dehumidification_010_dp_c": _value_at(cooling, 19),
        "dehumidification_010_mcdb_c": _value_at(cooling, 21),
        "record_low_c": record_low,
        "record_high_c": record_high,
    }
    design_missing = _missing(design_values)
    metrics = EpwStatMetrics(
        basis=basis,
        hdd65_f_days=hdd65,
        cdd50_f_days=cdd50,
        record_low_c=record_low,
        record_high_c=record_high,
        missing_fields=metrics_missing,
    )
    design = ClimateDesignConditions(
        basis=basis,
        source="stat",
        edition=_edition(lines),
        heating_996_db_c=design_values["heating_996_db_c"],
        heating_990_db_c=design_values["heating_990_db_c"],
        cooling_010_db_c=design_values["cooling_010_db_c"],
        cooling_010_mcwb_c=design_values["cooling_010_mcwb_c"],
        dehumidification_010_dp_c=design_values["dehumidification_010_dp_c"],
        dehumidification_010_mcdb_c=design_values["dehumidification_010_mcdb_c"],
        record_low_c=design_values["record_low_c"],
        record_high_c=design_values["record_high_c"],
        missing_fields=design_missing,
    )
    return ParsedStatPayload(station_name=station_name, wmo=wmo, basis=basis, metrics=metrics, design_conditions=design)


def _station_name(lines: list[str]) -> str | None:
    for line in lines:
        if line.startswith("Location --"):
            value = line.removeprefix("Location --").strip()
            return value or None
    return None


def _basis(lines: list[str]) -> str:
    edition = _edition(lines)
    return edition or "EnergyPlus STAT design conditions"


def _edition(lines: list[str]) -> str | None:
    for line in lines:
        match = _EDITION_RE.search(line)
        if match:
            return match.group(1).strip()
    return None


def _match_first(pattern: re.Pattern[str], lines: list[str]) -> str | None:
    for line in lines:
        match = pattern.search(line)
        if match:
            return match.group(1)
    return None


def _first_line(lines: list[str], needle: str) -> str | None:
    for line in lines:
        if needle in line:
            return line
    return None


def _first_row(lines: list[str], label: str) -> list[float]:
    line = _first_line(lines, f"\t{label}\t") or _first_line(lines, label)
    if line is None:
        return []
    return [float(value) for value in _NUMBER_RE.findall(line)]


def _annual_sum(line: str | None) -> float | None:
    if line is None:
        return None
    values = [float(value) for value in _NUMBER_RE.findall(line)]
    # Drop the base-temperature token(s) from e.g. "HDD base 18.3C".
    monthly = values[1:]
    if len(monthly) < 12:
        return None
    return float(sum(monthly[:12]))


def _value_at(values: list[float], index: int) -> float | None:
    return values[index] if index < len(values) else None


def _missing(values: dict[str, float | None]) -> list[str]:
    return [field for field, value in values.items() if value is None]
