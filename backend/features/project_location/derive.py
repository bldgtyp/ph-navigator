"""Derived geodata clients and climate-zone lookup for project locations."""

from __future__ import annotations

import csv
import json
import ssl
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import certifi
from pydantic import BaseModel, ConfigDict, Field
from starlette import status

from config import settings
from features.project_location.locality_index import is_zip_only_query, load_locality_index, search_localities
from features.project_location.models import GeocodeProjectLocationCandidate
from features.shared.errors import api_error

JsonFetcher = Callable[[str], dict[str, Any]]

_DATA_DIR = Path(__file__).with_name("data")
_CLIMATE_ZONE_CSV = _DATA_DIR / "climate_zones.csv"
_SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())


class CountyGeodata(BaseModel):
    """County/state identity returned by federal geocoder APIs."""

    model_config = ConfigDict(extra="forbid")

    county: str
    county_fips: str
    state: str
    state_fips: str | None = None
    country: str = "US"
    source: str


class ElevationGeodata(BaseModel):
    """Elevation result from the primary/fallback elevation chain."""

    model_config = ConfigDict(extra="forbid")

    elevation_m: float
    source: str


class ClimateZoneGeodata(BaseModel):
    """PNNL 2021 IECC climate-zone result keyed by county FIPS."""

    model_config = ConfigDict(extra="forbid")

    county_fips_5: str
    county_name: str
    state_name: str
    iecc_zone: str
    ba_zone: str
    source: str = "pnnl_2021_iecc"


class DerivedLocationGeodata(BaseModel):
    """Complete P1 derived-location bundle for persistence."""

    model_config = ConfigDict(extra="forbid")

    county: str
    county_fips: str
    state: str
    country: str
    elevation_m: float | None
    climate_zone: str | None
    geodata_provenance: dict[str, str] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


@dataclass(frozen=True)
class DeriveClients:
    """Injectable HTTP boundary for deterministic tests."""

    fetch_json: JsonFetcher = lambda url: fetch_json_url(url)


class AddressGeocoderError(RuntimeError):
    """The live Census address geocoder failed or returned an invalid envelope."""


def derive_location_geodata(
    latitude: float,
    longitude: float,
    clients: DeriveClients | None = None,
) -> DerivedLocationGeodata:
    """Derive county/state, elevation, and IECC climate zone from coordinates."""
    resolved_clients = clients or DeriveClients()
    with ThreadPoolExecutor(max_workers=2) as executor:
        county_future = executor.submit(fetch_county_geodata, latitude, longitude, resolved_clients.fetch_json)
        elevation_future = executor.submit(fetch_elevation_geodata, latitude, longitude, resolved_clients.fetch_json)
        county = county_future.result()
        elevation, elevation_warning = elevation_future.result()
    climate_zone = lookup_climate_zone(county.county_fips)
    warnings: list[str] = []
    if elevation_warning is not None:
        warnings.append(elevation_warning)
    if climate_zone is None:
        warnings.append(f"No PNNL 2021 IECC climate-zone row for county FIPS {county.county_fips}.")

    provenance = {
        "county": county.source,
        "state": county.source,
        "country": county.source,
    }
    if elevation is not None:
        provenance["elevation_m"] = elevation.source
    if climate_zone is not None:
        provenance["climate_zone"] = climate_zone.source

    return DerivedLocationGeodata(
        county=county.county,
        county_fips=county.county_fips,
        state=county.state,
        country=county.country,
        elevation_m=elevation.elevation_m if elevation is not None else None,
        climate_zone=climate_zone.iecc_zone if climate_zone is not None else None,
        geodata_provenance=provenance,
        warnings=warnings,
    )


def geocode_address(query: str, clients: DeriveClients | None = None) -> list[GeocodeProjectLocationCandidate]:
    """Resolve a bundled Census locality first, otherwise a live US address."""
    resolved_clients = clients or DeriveClients()
    if is_zip_only_query(query):
        return []
    index = load_locality_index()
    locality_candidates = search_localities(query, index)
    if locality_candidates:
        return locality_candidates
    try:
        payload = resolved_clients.fetch_json(_census_address_url(query))
    except (RuntimeError, ValueError) as exc:
        raise AddressGeocoderError("Census address geocoder request failed.") from exc
    try:
        return _parse_census_address_candidates(payload, query)
    except AddressGeocoderError:
        raise
    except (TypeError, ValueError) as exc:
        raise AddressGeocoderError("Census address geocoder response contains invalid candidate data.") from exc


def _parse_census_address_candidates(
    payload: dict[str, Any],
    query: str,
) -> list[GeocodeProjectLocationCandidate]:
    result = payload.get("result")
    if not isinstance(result, dict):
        raise AddressGeocoderError("Census address geocoder response has no result object.")
    matches = result.get("addressMatches")
    if not isinstance(matches, list):
        raise AddressGeocoderError("Census address geocoder response has no addressMatches list.")
    candidates: list[GeocodeProjectLocationCandidate] = []
    for match in matches[:5]:
        if not isinstance(match, dict):
            continue
        coordinates = match.get("coordinates")
        if not isinstance(coordinates, dict):
            continue
        longitude = coordinates.get("x")
        latitude = coordinates.get("y")
        if longitude is None or latitude is None:
            continue
        components = match.get("addressComponents")
        component_items = components if isinstance(components, dict) else {}
        matched_address = match.get("matchedAddress")
        label = str(matched_address or query)
        city = _optional_str(component_items.get("city"))
        state = _optional_str(component_items.get("state"))
        postal_code = _optional_str(component_items.get("zip"))
        candidates.append(
            GeocodeProjectLocationCandidate(
                result_type="address",
                label=label,
                latitude=float(latitude),
                longitude=float(longitude),
                street_address=street_address_from_full_address(label, city, state, postal_code),
                city=city,
                state=state,
                postal_code=postal_code,
                country="US",
                source="census_geocoder",
            )
        )
    return candidates


def fetch_county_geodata(latitude: float, longitude: float, fetch_json: JsonFetcher) -> CountyGeodata:
    """Use FCC first, then Census, because federal APIs have no SLA."""
    try:
        return _parse_fcc_county(fetch_json(_fcc_url(latitude, longitude)))
    except (KeyError, TypeError, ValueError, RuntimeError):
        pass
    try:
        return _parse_census_county(fetch_json(_census_url(latitude, longitude)))
    except (KeyError, TypeError, ValueError, RuntimeError) as exc:
        raise api_error(
            status.HTTP_502_BAD_GATEWAY,
            "county_lookup_failed",
            "Could not derive county/state for the project coordinates.",
        ) from exc


def fetch_elevation_geodata(
    latitude: float,
    longitude: float,
    fetch_json: JsonFetcher,
) -> tuple[ElevationGeodata | None, str | None]:
    """Use USGS EPQS first, then Open-Meteo, returning a warning if both miss."""
    try:
        return _parse_usgs_elevation(fetch_json(_usgs_epqs_url(latitude, longitude))), None
    except (KeyError, TypeError, ValueError, RuntimeError):
        pass
    try:
        return _parse_open_meteo_elevation(fetch_json(_open_meteo_url(latitude, longitude))), None
    except (KeyError, TypeError, ValueError, RuntimeError):
        return None, "Could not derive site elevation from USGS EPQS or Open-Meteo."


def lookup_climate_zone(county_fips: str) -> ClimateZoneGeodata | None:
    """Return the PNNL 2021 IECC county climate zone for a 5-digit FIPS code."""
    rows = _load_climate_zone_rows()
    row = rows.get(county_fips.zfill(5))
    if row is None:
        return None
    return ClimateZoneGeodata.model_validate(row)


def fetch_json_url(url: str) -> dict[str, Any]:
    """Fetch a JSON document with the short timeout used by derived-geodata calls."""
    request = Request(url, headers={"User-Agent": f"ph-navigator/{settings.app_version}"})
    try:
        with urlopen(request, timeout=settings.location_derive_timeout_seconds, context=_SSL_CONTEXT) as response:
            body = response.read()
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError(f"External location lookup failed: {url}") from exc
    payload = json.loads(body.decode("utf-8-sig"))
    if not isinstance(payload, dict):
        raise RuntimeError("External location lookup did not return a JSON object.")
    return payload


@cache
def _load_climate_zone_rows() -> dict[str, dict[str, str]]:
    with _CLIMATE_ZONE_CSV.open(encoding="utf-8", newline="") as handle:
        rows = {row["county_fips_5"].zfill(5): row for row in csv.DictReader(handle) if row.get("county_fips_5")}
    return rows


def _parse_fcc_county(payload: dict[str, Any]) -> CountyGeodata:
    county = payload["County"]
    state = payload["State"]
    return CountyGeodata(
        county=str(county["name"]),
        county_fips=str(county["FIPS"]).zfill(5),
        state=str(state.get("code") or state.get("name")),
        state_fips=str(state.get("FIPS")) if state.get("FIPS") is not None else None,
        source="fcc_area_api",
    )


def _parse_census_county(payload: dict[str, Any]) -> CountyGeodata:
    result = payload["result"]
    geographies = result["geographies"]
    county = geographies["Counties"][0]
    state = geographies["States"][0]
    return CountyGeodata(
        county=str(county["NAME"]),
        county_fips=str(county["GEOID"]).zfill(5),
        state=str(state["STUSAB"]),
        state_fips=str(state["STATE"]),
        source="census_geocoder",
    )


def _parse_usgs_elevation(payload: dict[str, Any]) -> ElevationGeodata:
    query = payload.get("value")
    if isinstance(query, dict):
        value = query.get("value")
    else:
        value = payload.get("value")
    if value is None:
        raise ValueError("USGS EPQS response did not include an elevation value.")
    elevation = float(value)
    if elevation <= -100000:
        raise ValueError("USGS EPQS returned a missing elevation sentinel.")
    return ElevationGeodata(elevation_m=elevation, source="usgs_epqs")


def _parse_open_meteo_elevation(payload: dict[str, Any]) -> ElevationGeodata:
    values = payload["elevation"]
    if not isinstance(values, list) or not values:
        raise ValueError("Open-Meteo response did not include elevation.")
    return ElevationGeodata(elevation_m=float(values[0]), source="open_meteo")


def _fcc_url(latitude: float, longitude: float) -> str:
    params = urlencode({"format": "json", "latitude": latitude, "longitude": longitude})
    return f"https://geo.fcc.gov/api/census/block/find?{params}"


def _census_url(latitude: float, longitude: float) -> str:
    params = urlencode(
        {
            "x": longitude,
            "y": latitude,
            "benchmark": "Public_AR_Current",
            "vintage": "Current_Current",
            "format": "json",
        }
    )
    return f"https://geocoding.geo.census.gov/geocoder/geographies/coordinates?{params}"


def _census_address_url(query: str) -> str:
    params = urlencode(
        {
            "address": query,
            "benchmark": "Public_AR_Current",
            "format": "json",
        }
    )
    return f"https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?{params}"


def _usgs_epqs_url(latitude: float, longitude: float) -> str:
    params = urlencode({"x": longitude, "y": latitude, "wkid": 4326, "units": "Meters", "output": "json"})
    return f"https://epqs.nationalmap.gov/v1/json?{params}"


def _open_meteo_url(latitude: float, longitude: float) -> str:
    params = urlencode({"latitude": latitude, "longitude": longitude})
    return f"https://api.open-meteo.com/v1/elevation?{params}"


def _optional_str(value: object) -> str | None:
    return str(value) if value else None


def street_address_from_full_address(
    full_address: str | None,
    city: str | None,
    state: str | None,
    postal_code: str | None,
    country: str | None = None,
) -> str | None:
    """Strip trailing city/state/ZIP from a geocoder label, leaving street only."""
    if not full_address:
        return None
    parts = [part.strip() for part in full_address.split(",") if part.strip()]
    while parts and country and parts[-1].casefold() == country.casefold():
        parts.pop()
    while parts and postal_code and parts[-1].casefold() == postal_code.casefold():
        parts.pop()
    while parts and state and parts[-1].casefold() == state.casefold():
        parts.pop()
    while parts and city and parts[-1].casefold() == city.casefold():
        parts.pop()
    return ", ".join(parts) or None
