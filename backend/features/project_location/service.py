"""Workflow rules for project-level location metadata."""

from __future__ import annotations

from typing import Any
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
from features.model_viewer.schemas.ladybug import SunPathAndCompassDTOSchema
from features.project_location import repository
from features.project_location.epw import EPW_HEADER_PREFIX_BYTES, parse_epw_location_header
from features.project_location.models import (
    EpwDescriptor,
    EpwParsedLocation,
    EpwParseResponse,
    ProjectLocation,
    ProjectLocationUpdateResponse,
    UpdateProjectLocationRequest,
)
from features.project_location.sun_path import build_sun_path
from features.projects.access import ProjectAccess
from features.shared.errors import api_error


def get_project_location(project_id: UUID) -> ProjectLocation:
    """Read a project's location, synthesizing the initial unset shape."""
    with connection() as conn:
        row = repository.get_location(conn, project_id)
        epw = epw_descriptor_for_row(conn, project_id, row)
    return project_location_from_row(row, epw)


def get_project_sun_path(project_id: UUID) -> SunPathAndCompassDTOSchema | None:
    """Build the project's sun-path diagram, or None when the location is unset.

    Climate consumes the `project_location` data in-process (D-CL-1). Returns
    None -- never raises -- when there is no location row or latitude/longitude
    are unset, because the sun path is undefined without coordinates. Optional
    fields fall back to neutral defaults: no elevation -> sea level, no true
    north -> +Y, no time zone -> the meridian implied by longitude.
    """
    with connection() as conn:
        row = repository.get_location(conn, project_id)
    if row is None or row["latitude"] is None or row["longitude"] is None:
        return None
    return build_sun_path(
        latitude=row["latitude"],
        longitude=row["longitude"],
        elevation_m=row["elevation_m"] if row["elevation_m"] is not None else 0.0,
        true_north_deg=row["true_north_deg"] if row["true_north_deg"] is not None else 0.0,
        time_zone=row["time_zone"],
    )


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
        changed_fields = changed_location_fields(values, current)
        if changed_fields:
            row = repository.upsert_location(conn, project_id, changed_fields, values)
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


def project_location_from_row(row: dict[str, Any] | None, epw: EpwDescriptor | None = None) -> ProjectLocation:
    """Convert the optional persistence row into the stable API shape."""
    if row is None:
        return ProjectLocation(is_set=False, updated_at=None, epw=None)

    values = {field: row[field] for field in UpdateProjectLocationRequest.model_fields}
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
