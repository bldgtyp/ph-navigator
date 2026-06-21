"""Single-station ashrae-meteo.info client for current-edition values."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

import certifi
import httpx

from config import settings
from features.climate.design_conditions import ClimateDesignConditions

ASHRAE_METEO_BASE_URL = "https://ashrae-meteo.info/v3.0/"
AshraeVersion = Literal["2009", "2013", "2017", "2021", "2025"]


@dataclass(frozen=True)
class AshraeMeteoResult:
    station_id: str
    label: str
    url: str
    design_conditions: ClimateDesignConditions


def fetch_nearest_ashrae_station_conditions(
    *,
    latitude: float,
    longitude: float,
    ashrae_version: AshraeVersion = "2025",
) -> AshraeMeteoResult:
    with httpx.Client(
        timeout=settings.location_derive_timeout_seconds,
        verify=certifi.where(),
        follow_redirects=True,
    ) as client:
        places = client.post(
            f"{ASHRAE_METEO_BASE_URL}request_places.php",
            data={
                "lat": f"{latitude:.3f}",
                "long": f"{longitude:.3f}",
                "number": "1",
                "ashrae_version": ashrae_version,
            },
        )
        places.raise_for_status()
        station = _first_station(_decode_json_text(places.text))
        details = client.post(
            f"{ASHRAE_METEO_BASE_URL}request_meteo_parametres.php",
            data={"wmo": station.get("wmo"), "ashrae_version": ashrae_version, "si_ip": "SI"},
        )
        details.raise_for_status()
    detail_station = {**station, **_first_station(_decode_json_text(details.text))}
    design_conditions = design_conditions_from_ashrae_station(detail_station, ashrae_version=ashrae_version)
    station_id = str(detail_station.get("wmo") or "")
    label = str(detail_station.get("place") or detail_station.get("name") or station_id or "ASHRAE station")
    return AshraeMeteoResult(
        station_id=station_id,
        label=label,
        url=f"{ASHRAE_METEO_BASE_URL}index.php?ashrae_version={ashrae_version}&wmo={station_id}",
        design_conditions=design_conditions,
    )


def fetch_nearest_ashrae_design_conditions(
    *,
    latitude: float,
    longitude: float,
    ashrae_version: AshraeVersion = "2025",
) -> ClimateDesignConditions:
    return fetch_nearest_ashrae_station_conditions(
        latitude=latitude,
        longitude=longitude,
        ashrae_version=ashrae_version,
    ).design_conditions


def design_conditions_from_ashrae_station(
    station: dict[str, Any],
    *,
    ashrae_version: str,
) -> ClimateDesignConditions:
    values = {
        "heating_996_db_c": _number(station, "heating_DB_996", "heating_99_6_DB", "heating_DB_99_6"),
        "heating_990_db_c": _number(station, "heating_DB_990", "heating_99_DB", "heating_DB_99"),
        "cooling_010_db_c": _number(station, "cooling_DB_MCWB_1_DB", "cooling_DB_1_DB", "cooling_1_DB"),
        "cooling_010_mcwb_c": _number(station, "cooling_DB_MCWB_1_MCWB", "cooling_DB_1_MCWB", "cooling_1_MCWB"),
        "dehumidification_010_dp_c": _number(station, "dehumidification_DP_MCDB_1_DP", "dehumidification_1_DP"),
        "dehumidification_010_mcdb_c": _number(station, "dehumidification_DP_MCDB_1_MCDB", "dehumidification_1_MCDB"),
        "record_low_c": _number(station, "extreme_annual_DB_min", "extreme_DB_min", "record_low_c"),
        "record_high_c": _number(station, "extreme_annual_DB_max", "extreme_DB_max", "record_high_c"),
    }
    missing = [field for field, value in values.items() if value is None]
    place = str(station.get("place") or station.get("name") or station.get("wmo") or "ASHRAE station")
    return ClimateDesignConditions(
        basis=f"ASHRAE Meteo {ashrae_version} / {place}",
        source="ashrae-meteo",
        edition=ashrae_version,
        missing_fields=missing,
        fetched_at=datetime.now(tz=UTC),
        **values,
    )


def _decode_json_text(text: str) -> dict[str, Any]:
    clean = text.strip().encode("utf-8").decode("utf-8-sig").strip()
    while clean.startswith('"') and clean.endswith('"'):
        clean = json.loads(clean)
    return dict(json.loads(clean))


def _first_station(payload: dict[str, Any]) -> dict[str, Any]:
    stations = payload.get("meteo_stations")
    if not isinstance(stations, list) or not stations or not isinstance(stations[0], dict):
        raise ValueError("ashrae_meteo_station_not_found")
    return dict(stations[0])


def _number(station: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = station.get(key)
        if value is None or value == "n/a":
            continue
        try:
            return float(str(value).strip())
        except ValueError:
            continue
    return None
