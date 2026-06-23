"""Workflow rules for project-level location metadata."""

from __future__ import annotations

from typing import Any, cast
from uuid import UUID

from fastapi import Request
from psycopg import Connection
from starlette import status

from database import connection, transaction
from features.assets import repository as asset_repository
from features.assets.service import AssetService
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import client_ip, user_agent
from features.climate import repository as climate_repository
from features.climate.epw_catalog import download_epw_zip, nearest_epw_entry
from features.climate.models import ClimateLocationSummary
from features.climate.proximity import PhDatasetProvider, build_location_roster, build_proximity_payload
from features.climate.weather_source import build_weather_source_payload
from features.project_climate_source import repository as climate_source_repository
from features.project_climate_source.service import attach_weather_source, upsert_source_by_kind
from features.project_location import repository
from features.project_location.derive import (
    derive_location_geodata,
    fetch_elevation_geodata,
    fetch_json_url,
    geocode_address,
)
from features.project_location.epw import EPW_HEADER_PREFIX_BYTES, parse_epw_location_header
from features.project_location.models import (
    ElevationLookupResponse,
    EpwDescriptor,
    EpwParsedLocation,
    EpwParseResponse,
    GeocodeProjectLocationRequest,
    GeocodeProjectLocationResponse,
    ProjectLocation,
    ProjectLocationUpdateResponse,
    UpdateProjectLocationRequest,
)
from features.projects.access import ProjectAccess
from features.shared.errors import api_error

COORDINATE_FIELDS = {"latitude", "longitude"}
AUTO_ATTACH_PROVIDERS: tuple[PhDatasetProvider, ...] = ("phius", "phi")
# DB-nearest candidates re-ranked by exact haversine before taking the closest.
_AUTO_ATTACH_CANDIDATE_LIMIT = 8
# Derived geodata cleared when coordinates are removed (county/zone go stale).
_EMPTY_GEODATA: dict[str, object] = {
    "county": None,
    "county_fips": None,
    "country": None,
    "climate_zone": None,
    "geodata_provenance": {},
}


def get_project_location(project_id: UUID, *, include_private: bool = True) -> ProjectLocation:
    """Read a project's location, synthesizing the initial unset shape."""
    with connection() as conn:
        row = repository.get_location(conn, project_id)
        epw = epw_descriptor_for_row(conn, project_id, row)
    return project_location_from_row(row, epw, include_private=include_private)


def update_project_location(
    project_id: UUID,
    payload: UpdateProjectLocationRequest,
    user: UserPublic,
    request_meta: Request | None,
) -> ProjectLocationUpdateResponse:
    """Apply a partial location update without touching versioned project JSON.

    Setting the site is the single front door for the project's geodata: when the
    coordinates move, county/state/elevation/zone are derived here (the heavy
    external lookups run *before* the transaction is opened). The per-type climate
    sources are attached separately from their own Climate pages.
    """
    values = payload.model_dump(exclude_unset=True)
    with connection() as conn:
        existing = repository.get_location(conn, project_id)
    geodata_warnings = apply_derived_geodata_on_coordinate_change(values, existing)

    with transaction() as conn:
        current = repository.get_location(conn, project_id)
        validate_epw_asset_reference(conn, project_id, values)
        changed_fields = changed_location_fields(values, current)
        if changed_fields:
            row = repository.upsert_location(conn, project_id, changed_fields, values)
            refresh_existing_certification_source_proximities(
                conn,
                project_id=project_id,
                latitude=float(row["latitude"]) if row["latitude"] is not None else None,
                longitude=float(row["longitude"]) if row["longitude"] is not None else None,
                elevation_m=float(row["elevation_m"]) if row["elevation_m"] is not None else None,
            )
            auth_repository.log_action(
                conn,
                action="project_location_update",
                user_id=user.id,
                email=user.email,
                session_id=None,
                ip_address=client_ip(request_meta) if request_meta else None,
                user_agent=user_agent(request_meta) if request_meta else None,
                details={"project_id": str(project_id), "fields": sorted(changed_fields)},
            )
        else:
            row = current
        epw = epw_descriptor_for_row(conn, project_id, row)

    return ProjectLocationUpdateResponse(
        location=project_location_from_row(row, epw),
        warnings=[*geodata_warnings, *epw_mismatch_warnings(row, epw)],
    )


def derive_certification_source(
    project_id: UUID,
    provider: PhDatasetProvider,
    user: UserPublic,
    request_meta: Request | None,
) -> ProjectLocationUpdateResponse:
    """Attach the nearest Phius *or* PHI reference dataset for the saved site.

    Reads the project's persisted coordinates (set via Set Location) — the
    per-type "Set from nearest" action takes no coordinates of its own.
    """
    with transaction() as conn:
        row = repository.get_location(conn, project_id)
        latitude, longitude, elevation_m = require_site_coordinates(row)
        warnings = auto_attach_certification_source(
            conn,
            project_id=project_id,
            provider=provider,
            latitude=latitude,
            longitude=longitude,
            elevation_m=elevation_m,
        )
        log_climate_source_derive(conn, project_id=project_id, kind=provider, user=user, request_meta=request_meta)
        epw = epw_descriptor_for_row(conn, project_id, row)

    return ProjectLocationUpdateResponse(location=project_location_from_row(row, epw), warnings=warnings)


def derive_weather_source(
    project_id: UUID,
    user: UserPublic,
    request_meta: Request | None,
    asset_service: AssetService,
) -> ProjectLocationUpdateResponse:
    """Attach the nearest weather file (EPW + STAT bundle) for the saved site.

    The one ``weather`` source carries both the EPW pointer and the STAT-derived
    metrics + ASHRAE design conditions (they ride free on the EPW's ``.stat``
    companion). The Weather File Climate page triggers this.
    """
    with connection() as conn:
        row = repository.get_location(conn, project_id)
    latitude, longitude, _elevation_m = require_site_coordinates(row)
    weather_source, weather_values, weather_warnings = prepare_weather_source(
        project_id=project_id,
        latitude=latitude,
        longitude=longitude,
        user=user,
        asset_service=asset_service,
    )

    with transaction() as conn:
        current = repository.get_location(conn, project_id)
        changed_fields = changed_location_fields(weather_values, current)
        row = (
            repository.upsert_location(conn, project_id, changed_fields, weather_values) if changed_fields else current
        )
        if weather_source is not None:
            attach_weather_source(conn, project_id=project_id, source=weather_source)
        log_climate_source_derive(conn, project_id=project_id, kind="weather", user=user, request_meta=request_meta)
        epw = epw_descriptor_for_row(conn, project_id, row)

    return ProjectLocationUpdateResponse(
        location=project_location_from_row(row, epw),
        warnings=[*weather_warnings, *epw_mismatch_warnings(row, epw)],
    )


def require_site_coordinates(row: dict[str, Any] | None) -> tuple[float, float, float | None]:
    """Return (lat, long, elevation) for a saved site, or 409 if it is unset."""
    if row is None or row["latitude"] is None or row["longitude"] is None:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "location_not_set",
            "Set the project location before deriving climate data from the nearest source.",
        )
    elevation = row["elevation_m"]
    return float(row["latitude"]), float(row["longitude"]), float(elevation) if elevation is not None else None


def log_climate_source_derive(
    conn: Connection[Any],
    *,
    project_id: UUID,
    kind: str,
    user: UserPublic,
    request_meta: Request | None,
) -> None:
    auth_repository.log_action(
        conn,
        action="project_climate_source_derive",
        user_id=user.id,
        email=user.email,
        session_id=None,
        ip_address=client_ip(request_meta) if request_meta else None,
        user_agent=user_agent(request_meta) if request_meta else None,
        details={"project_id": str(project_id), "kind": kind},
    )


def geocode_project_location(payload: GeocodeProjectLocationRequest) -> GeocodeProjectLocationResponse:
    """Resolve editor-entered address text into candidate coordinates."""
    return GeocodeProjectLocationResponse(candidates=geocode_address(payload.query))


def lookup_site_elevation(latitude: float, longitude: float) -> ElevationLookupResponse:
    """Resolve site elevation for coordinates without persisting or attaching anything.

    The Set Location modal calls this to auto-fill its elevation field the moment
    coordinates change. Deliberately lighter than ``derive_project_location``: it
    reuses the USGS-3DEP-then-Open-Meteo chain but writes no row and attaches no
    climate sources, so setting a location has no surprise side effects.
    """
    elevation, warning = fetch_elevation_geodata(latitude, longitude, fetch_json_url)
    if elevation is None:
        return ElevationLookupResponse(warning=warning)
    return ElevationLookupResponse(elevation_m=elevation.elevation_m, source=elevation.source)


def parse_epw_location(access: ProjectAccess, asset_id: str, asset_service: AssetService) -> EpwParseResponse:
    """Parse an uploaded EPW asset and retain the parsed header snapshot on the asset."""
    asset, prefix = asset_service.read_asset_prefix(access, asset_id, EPW_HEADER_PREFIX_BYTES)
    if asset.asset_kind != "epw":
        raise api_error(status.HTTP_422_UNPROCESSABLE_CONTENT, "asset_kind_mismatch", "Asset is not an EPW file.")
    try:
        suggestion = parse_epw_location_header(prefix)
    except ValueError as exc:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "epw_location_header_invalid",
            "EPW LOCATION header could not be parsed.",
            {"asset_id": asset_id, "reason": str(exc)},
        ) from exc
    suggestion_json = suggestion.model_dump(mode="json")
    if asset.metadata.epw_location != suggestion_json:
        asset_service.set_metadata(access, asset_id, {"epw_location": suggestion_json})
    return EpwParseResponse(asset_id=asset.id, filename=asset.original_filename, suggestion=suggestion)


def changed_location_fields(values: dict[str, object], current: dict[str, Any] | None) -> set[str]:
    """Return payload fields whose value differs from the persisted row."""
    if current is None:
        return set(values)
    changed: set[str] = set()
    for field, value in values.items():
        if current[field] != value:
            changed.add(field)
    return changed


def apply_derived_geodata_on_coordinate_change(
    values: dict[str, object],
    current: dict[str, Any] | None,
) -> list[str]:
    """Re-derive county/state/elevation/zone when the coordinates move.

    Returns derive warnings to surface on the write. A user-supplied state or
    elevation in the same write is preserved; only an absent one adopts the
    derived value. Clearing the coordinates clears the now-stale derivations.
    """
    changed_coordinates = COORDINATE_FIELDS.intersection(values)
    if not changed_coordinates:
        return []
    if current is not None and not any(current[field] != values[field] for field in changed_coordinates):
        return []

    latitude = values["latitude"] if "latitude" in values else (current["latitude"] if current else None)
    longitude = values["longitude"] if "longitude" in values else (current["longitude"] if current else None)
    if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
        values.update(_EMPTY_GEODATA)
        return []

    derived = derive_location_geodata(float(latitude), float(longitude))
    values["county"] = derived.county
    values["county_fips"] = derived.county_fips
    values["country"] = derived.country
    values["climate_zone"] = derived.climate_zone
    values["geodata_provenance"] = derived.geodata_provenance
    if not values.get("state"):
        values["state"] = derived.state
    if values.get("elevation_m") is None:
        values["elevation_m"] = derived.elevation_m
    return derived.warnings


def auto_attach_certification_source(
    conn: Connection[Any],
    *,
    project_id: UUID,
    provider: PhDatasetProvider,
    latitude: float,
    longitude: float,
    elevation_m: float | None,
) -> list[str]:
    """Attach/update the nearest Phius or PHI reference location for a project."""
    dataset = climate_repository.get_latest_dataset_for_provider(conn, provider)
    if dataset is None:
        return [f"No seeded {provider.upper()} climate dataset is available."]
    candidate_rows = climate_repository.nearest_locations(
        conn,
        dataset["id"],
        latitude=latitude,
        longitude=longitude,
        limit=_AUTO_ATTACH_CANDIDATE_LIMIT,
    )
    roster = build_location_roster(
        provider=provider,
        locations=[ClimateLocationSummary.model_validate(row) for row in candidate_rows],
        site_latitude=latitude,
        site_longitude=longitude,
        site_elevation_m=elevation_m,
    )
    if not roster:
        return [f"No {provider.upper()} climate locations are available."]
    location, _verdict = roster[0]
    payload = build_proximity_payload(
        provider=provider,
        dataset=dataset,
        location=location,
        site_latitude=latitude,
        site_longitude=longitude,
        site_elevation_m=elevation_m,
    )
    upsert_source_by_kind(
        conn,
        project_id=project_id,
        kind=provider,
        ref=str(location.id),
        label=location.name,
        data=payload.model_dump(mode="json"),
    )
    return []


def refresh_existing_certification_source_proximities(
    conn: Connection[Any],
    *,
    project_id: UUID,
    latitude: float | None,
    longitude: float | None,
    elevation_m: float | None,
) -> None:
    """Recompute stored PHIUS/PHI proximity snapshots after a site-location edit.

    This preserves the user's attached dataset/station and updates only the
    site-vs-station distance/elevation verdict shown on the source detail page.
    """
    if latitude is None or longitude is None:
        return

    for source in climate_source_repository.list_sources(conn, project_id):
        kind = source["kind"]
        if kind not in AUTO_ATTACH_PROVIDERS or source["ref"] is None:
            continue

        location_row = climate_repository.get_location(conn, UUID(str(source["ref"])))
        if location_row is None:
            continue
        location = ClimateLocationSummary.model_validate(location_row)
        dataset = climate_repository.get_dataset(conn, location.dataset_id)
        if dataset is None:
            continue

        existing_data = source["data"] if isinstance(source["data"], dict) else {}
        payload = build_proximity_payload(
            provider=cast(PhDatasetProvider, kind),
            dataset=dataset,
            location=location,
            site_latitude=latitude,
            site_longitude=longitude,
            site_elevation_m=elevation_m,
            auto_attached=bool(existing_data.get("auto_attached", True)),
        )
        climate_source_repository.update_source(
            conn,
            source["id"],
            {"data": payload.model_dump(mode="json")},
        )


def prepare_weather_source(
    *,
    project_id: UUID,
    latitude: float,
    longitude: float,
    user: UserPublic,
    asset_service: AssetService,
) -> tuple[dict[str, object] | None, dict[str, object], list[str]]:
    """Fetch nearest EPW + STAT data before opening the location transaction.

    Returns the weather source to attach (``None`` when nothing changes — no
    catalog entry, or the same OneBuilding EPW is already attached), the location
    fields to persist, and any warnings.
    """
    warnings: list[str] = []
    try:
        entry = nearest_epw_entry(latitude, longitude)
    except Exception as exc:
        return None, {}, [f"Nearest EPW lookup failed: {exc}"]
    if entry is None:
        return None, {}, ["No OneBuilding EPW catalog entries are available for auto-attach."]
    existing_values = existing_weather_source_values(project_id, entry.url)
    if existing_values is not None:
        return None, existing_values, warnings
    try:
        epw_payload = download_epw_zip(entry)
    except Exception as exc:
        return None, {}, [f"Nearest EPW download failed: {exc}"]
    try:
        source = build_weather_source_payload(project_id, user, asset_service, epw_payload)
        values: dict[str, object] = {"epw_source_url": entry.url, "epw_asset_id": str(source["ref"])}
        return source, values, warnings
    except Exception as exc:
        return None, {}, [f"Nearest EPW parse/storage failed: {exc}"]


def existing_weather_source_values(project_id: UUID, source_url: str) -> dict[str, object] | None:
    """Reuse an already-attached weather source from the same OneBuilding URL."""
    with connection() as conn:
        sources = climate_source_repository.list_sources(conn, project_id)
    weather_source = next(
        (
            source
            for source in sources
            if source["kind"] == "weather"
            and isinstance(source["data"], dict)
            and source["data"].get("source_url") == source_url
            and source["ref"]
        ),
        None,
    )
    if weather_source is None:
        return None
    return {"epw_asset_id": str(weather_source["ref"]), "epw_source_url": source_url}


def project_location_from_row(
    row: dict[str, Any] | None,
    epw: EpwDescriptor | None = None,
    *,
    include_private: bool = True,
) -> ProjectLocation:
    """Convert the optional persistence row into the stable API shape."""
    if row is None:
        return ProjectLocation(is_set=False, updated_at=None, epw=None)

    values = {field: row[field] for field in ProjectLocation.model_fields if field in row}
    if not include_private:
        values["street_address"] = None
    return ProjectLocation.model_validate(
        {
            **values,
            "is_set": True,
            "updated_at": row["updated_at"],
            "epw": epw,
        }
    )


def validate_epw_asset_reference(conn: Connection[Any], project_id: UUID, values: dict[str, object]) -> None:
    asset_id = values.get("epw_asset_id")
    if asset_id is None:
        return
    if not isinstance(asset_id, str):
        raise api_error(status.HTTP_422_UNPROCESSABLE_CONTENT, "asset_invalid", "EPW asset id must be a string.")
    asset = asset_repository.get_asset_by_id(conn, project_id, asset_id)
    if asset is None:
        raise api_error(status.HTTP_422_UNPROCESSABLE_CONTENT, "asset_not_found", "EPW asset was not found.")
    if asset.asset_kind != "epw":
        raise api_error(status.HTTP_422_UNPROCESSABLE_CONTENT, "asset_kind_mismatch", "Asset is not an EPW file.")
    if asset.upload_status != "uploaded":
        raise api_error(status.HTTP_409_CONFLICT, "asset_upload_incomplete", "Asset upload is not complete.")


def epw_descriptor_for_row(conn: Connection[Any], project_id: UUID, row: dict[str, Any] | None) -> EpwDescriptor | None:
    if row is None:
        return None
    asset_id = row.get("epw_asset_id")
    if not isinstance(asset_id, str):
        return None
    asset = asset_repository.get_asset_by_id(conn, project_id, asset_id)
    if asset is None:
        return None
    parsed_raw = asset.metadata.epw_location
    parsed = EpwParsedLocation.model_validate(parsed_raw) if isinstance(parsed_raw, dict) else None
    return EpwDescriptor(
        id=asset.id,
        filename=asset.original_filename,
        source_url=row.get("epw_source_url"),
        parsed_location=parsed,
    )


def epw_mismatch_warnings(row: dict[str, Any] | None, epw: EpwDescriptor | None) -> list[str]:
    if row is None or epw is None or epw.parsed_location is None:
        return []
    parsed = epw.parsed_location
    deltas = []
    if row["latitude"] is not None and parsed.latitude is not None:
        deltas.append(abs(row["latitude"] - parsed.latitude))
    if row["longitude"] is not None and parsed.longitude is not None:
        deltas.append(abs(row["longitude"] - parsed.longitude))
    if not deltas or max(deltas) <= 1:
        return []
    return ["Weather file location differs from project location by more than 1 degree."]
