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
from features.climate.epw_catalog import EpwZipPayload, download_epw_zip, nearest_epw_entry
from features.climate.models import ClimateLocationSummary
from features.climate.proximity import PhDatasetProvider, build_location_roster, build_proximity_payload
from features.climate.stat_parser import parse_stat_file
from features.project_climate_source import repository as climate_source_repository
from features.project_climate_source.service import upsert_source_by_kind
from features.project_location import repository
from features.project_location.derive import (
    derive_location_geodata,
    fetch_elevation_geodata,
    fetch_json_url,
    geocode_address,
)
from features.project_location.epw import EPW_HEADER_PREFIX_BYTES, parse_epw_location_header
from features.project_location.models import (
    DeriveProjectLocationRequest,
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
    """Apply a partial location update without touching versioned project JSON."""
    values = payload.model_dump(exclude_unset=True)
    with transaction() as conn:
        current = repository.get_location(conn, project_id)
        validate_epw_asset_reference(conn, project_id, values)
        clear_derived_geodata_if_coordinates_change(values, current)
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
        warnings=epw_mismatch_warnings(row, epw),
    )


def derive_project_location(
    project_id: UUID,
    payload: DeriveProjectLocationRequest,
    user: UserPublic,
    request_meta: Request | None,
    asset_service: AssetService,
) -> ProjectLocationUpdateResponse:
    """Derive and persist county/state, elevation, and IECC zone for coordinates."""
    derived = derive_location_geodata(payload.latitude, payload.longitude)
    weather_sources, weather_values, weather_warnings = prepare_weather_sources(
        project_id=project_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        user=user,
        asset_service=asset_service,
    )
    values: dict[str, object] = {
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "county": derived.county,
        "county_fips": derived.county_fips,
        "state": derived.state,
        "country": derived.country,
        "elevation_m": derived.elevation_m,
        "climate_zone": derived.climate_zone,
        "geodata_provenance": derived.geodata_provenance,
        **weather_values,
    }
    if payload.site_address is not None:
        values["site_address"] = payload.site_address

    with transaction() as conn:
        current = repository.get_location(conn, project_id)
        changed_fields = changed_location_fields(values, current)
        row = repository.upsert_location(conn, project_id, changed_fields, values) if changed_fields else current
        auto_attach_warnings = auto_attach_certification_sources(
            conn,
            project_id=project_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            elevation_m=derived.elevation_m,
        )
        auto_attach_weather_sources(conn, project_id=project_id, sources=weather_sources)
        auth_repository.log_action(
            conn,
            action="project_location_derive",
            user_id=user.id,
            email=user.email,
            session_id=None,
            ip_address=client_ip(request_meta) if request_meta else None,
            user_agent=user_agent(request_meta) if request_meta else None,
            details={"project_id": str(project_id), "fields": sorted(changed_fields)},
        )
        epw = epw_descriptor_for_row(conn, project_id, row)

    return ProjectLocationUpdateResponse(
        location=project_location_from_row(row, epw),
        warnings=[
            *derived.warnings,
            *auto_attach_warnings,
            *weather_warnings,
            *epw_mismatch_warnings(row, epw),
        ],
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


def clear_derived_geodata_if_coordinates_change(values: dict[str, object], current: dict[str, Any] | None) -> None:
    """Clear county/zone derivations when raw coordinates are edited directly."""
    changed_coordinates = COORDINATE_FIELDS.intersection(values)
    if current is None or not changed_coordinates:
        return
    if not any(current[field] != values[field] for field in changed_coordinates):
        return
    values.update(
        {
            "county": None,
            "county_fips": None,
            "country": None,
            "climate_zone": None,
            "geodata_provenance": {},
        }
    )


def auto_attach_certification_sources(
    conn: Connection[Any],
    *,
    project_id: UUID,
    latitude: float,
    longitude: float,
    elevation_m: float | None,
) -> list[str]:
    """Attach/update nearest Phius and PHI reference locations for a project."""
    warnings: list[str] = []
    for provider in AUTO_ATTACH_PROVIDERS:
        dataset = climate_repository.get_latest_dataset_for_provider(conn, provider)
        if dataset is None:
            warnings.append(f"No seeded {provider.upper()} climate dataset is available for auto-attach.")
            continue
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
            warnings.append(f"No {provider.upper()} climate locations are available for auto-attach.")
            continue
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
    return warnings


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


def prepare_weather_sources(
    *,
    project_id: UUID,
    latitude: float,
    longitude: float,
    user: UserPublic,
    asset_service: AssetService,
) -> tuple[list[dict[str, object]], dict[str, object], list[str]]:
    """Fetch nearest EPW + STAT data before opening the location transaction."""
    warnings: list[str] = []
    try:
        entry = nearest_epw_entry(latitude, longitude)
    except Exception as exc:
        return [], {}, [f"Nearest EPW lookup failed: {exc}"]
    if entry is None:
        return [], {}, ["No OneBuilding EPW catalog entries are available for auto-attach."]
    existing_values = existing_weather_source_values(project_id, entry.url)
    if existing_values is not None:
        return [], existing_values, warnings
    try:
        epw_payload = download_epw_zip(entry)
    except Exception as exc:
        return [], {}, [f"Nearest EPW download failed: {exc}"]
    try:
        sources = build_weather_source_payloads(project_id, user, asset_service, epw_payload)
        values: dict[str, object] = {"epw_source_url": entry.url}
        epw_source = next((source for source in sources if source["kind"] == "epw"), None)
        if epw_source is not None:
            values["epw_asset_id"] = str(epw_source["ref"])
        return sources, values, warnings
    except Exception as exc:
        return [], {}, [f"Nearest EPW parse/storage failed: {exc}"]


def existing_weather_source_values(project_id: UUID, source_url: str) -> dict[str, object] | None:
    """Reuse an already-attached EPW from the same OneBuilding URL."""
    with connection() as conn:
        sources = climate_source_repository.list_sources(conn, project_id)
    epw_source = next(
        (
            source
            for source in sources
            if source["kind"] == "epw"
            and isinstance(source["data"], dict)
            and source["data"].get("source_url") == source_url
            and source["ref"]
        ),
        None,
    )
    if epw_source is None:
        return None
    return {"epw_asset_id": str(epw_source["ref"]), "epw_source_url": source_url}


def build_weather_source_payloads(
    project_id: UUID,
    user: UserPublic,
    asset_service: AssetService,
    epw_payload: EpwZipPayload,
) -> list[dict[str, Any]]:
    """Store the EPW bytes and build project_climate_source upsert payloads."""
    epw_location = parse_epw_location_header(epw_payload.epw_bytes[:EPW_HEADER_PREFIX_BYTES])
    asset = asset_service.create_uploaded_asset_from_bytes(
        project_id=project_id,
        created_by=user.id,
        asset_kind="epw",
        original_filename=epw_payload.epw_name,
        display_name=epw_payload.entry.name,
        content_type="text/plain",
        body=epw_payload.epw_bytes,
        metadata={"epw_location": epw_location.model_dump(mode="json"), "thumbnail_status": "na"},
    )
    fetched_at = asset.uploaded_at.isoformat() if asset.uploaded_at else None
    stat_payload = parse_stat_file(epw_payload.stat_text) if epw_payload.stat_text else None
    station = {
        "name": epw_payload.entry.name,
        "country": epw_payload.entry.country,
        "region": epw_payload.entry.region,
        "wmo": epw_payload.entry.wmo,
        "latitude": epw_payload.entry.latitude,
        "longitude": epw_payload.entry.longitude,
        "elevation_m": epw_payload.entry.elevation_m,
        "distance_mi": epw_payload.entry.distance_mi,
    }
    epw_data: dict[str, object] = {
        "provider": "onebuilding",
        "source_url": epw_payload.entry.url,
        "stat_filename": epw_payload.stat_name,
        "station": station,
        "fetched_at": fetched_at,
    }
    if stat_payload is not None:
        epw_data["stat_metrics"] = stat_payload.metrics.model_dump(mode="json")
        epw_data["design_conditions"] = stat_payload.design_conditions.model_dump(mode="json")
    sources: list[dict[str, Any]] = [
        {
            "kind": "epw",
            "ref": asset.id,
            "label": epw_payload.entry.name,
            "data": epw_data,
        }
    ]
    if stat_payload is not None:
        sources.append(
            {
                "kind": "ashrae",
                "ref": stat_payload.wmo or epw_payload.entry.wmo or epw_payload.entry.name,
                "label": stat_payload.station_name or epw_payload.entry.name,
                "data": {
                    "provider": "onebuilding_stat",
                    "source_url": epw_payload.entry.url,
                    "design_conditions": stat_payload.design_conditions.model_dump(mode="json"),
                    "missing_fields": stat_payload.design_conditions.missing_fields,
                    "fetched_at": fetched_at,
                },
            }
        )
    return sources


def auto_attach_weather_sources(
    conn: Connection[Any],
    *,
    project_id: UUID,
    sources: list[dict[str, object]],
) -> None:
    for source in sources:
        upsert_source_by_kind(
            conn,
            project_id=project_id,
            kind=str(source["kind"]),
            ref=str(source["ref"]),
            label=str(source["label"]),
            data=cast(dict[str, Any], source["data"] if isinstance(source["data"], dict) else {}),
        )


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
        values["site_address"] = None
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
