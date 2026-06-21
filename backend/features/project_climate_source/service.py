"""Workflow rules for project-scoped climate sources.

Reads go through :func:`list_project_climate_sources`; mutations run in a
single transaction, validate the source shape (and that any referenced
reference-dataset location / EPW asset actually exists), enforce the
one-default-per-project rule (D-CL-11), and append an audit-log entry —
mirroring the ``project_location`` service.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from fastapi import Request
from psycopg import Connection
from pydantic import ValidationError
from starlette import status

from database import connection, transaction
from features.assets import repository as asset_repository
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import client_ip, user_agent
from features.climate import repository as climate_repository
from features.climate.ashrae_meteo import fetch_nearest_ashrae_station_conditions
from features.climate.models import ClimateLocationSummary
from features.climate.proximity import PhDatasetProvider, build_location_roster, build_proximity_payload
from features.climate.record import ClimateRecord
from features.project_climate_source import repository
from features.project_climate_source.models import (
    ClimateDatasetRef,
    ClimateDatasetRosterItem,
    ClimateDatasetRosterResponse,
    CreateProjectClimateSourceRequest,
    ProjectClimateSourceListResponse,
    ProjectClimateSourcePublic,
    RefreshAshraeDesignConditionsRequest,
    RosterProjectLocation,
    UpdateProjectClimateSourceRequest,
    validate_source_shape,
)
from features.project_location import repository as location_repository
from features.shared.errors import api_error


def list_project_climate_sources(project_id: UUID) -> ProjectClimateSourceListResponse:
    with connection() as conn:
        rows = repository.list_sources(conn, project_id)
    return ProjectClimateSourceListResponse(items=[ProjectClimateSourcePublic.model_validate(row) for row in rows])


def get_project_dataset_roster(
    project_id: UUID,
    kind: PhDatasetProvider,
    *,
    region: str | None,
    near: bool,
    limit: int,
    offset: int,
) -> ClimateDatasetRosterResponse:
    """The picker feed: a PH dataset's stations for a project, proximity-ranked.

    Resolves the project site (raising the no-location guard when unset), the
    pinned dataset for ``kind`` (null when unseeded), and the candidate
    stations — by ``region`` (defaulting to the project's state) or, when
    ``near`` is set, the nearest across all states (O-DP-3). Each station is
    paired with its backend-computed proximity verdict, nearest-first (D-DP-2).
    """
    with connection() as conn:
        site = _load_project_site(conn, project_id)

        dataset = climate_repository.get_latest_dataset_for_provider(conn, kind)
        if dataset is None:
            return ClimateDatasetRosterResponse(dataset=None, project=site, items=[], total=0)

        if near:
            rows = climate_repository.nearest_locations(
                conn, dataset["id"], latitude=site.latitude, longitude=site.longitude, limit=limit
            )
            total = len(rows)
        else:
            effective_region = region if region is not None else site.state
            rows = climate_repository.search_locations(
                conn, dataset["id"], country=None, region=effective_region, limit=limit, offset=offset
            )
            total = climate_repository.count_locations(conn, dataset["id"], country=None, region=effective_region)

    roster = build_location_roster(
        provider=kind,
        locations=[ClimateLocationSummary.model_validate(row) for row in rows],
        site_latitude=site.latitude,
        site_longitude=site.longitude,
        site_elevation_m=site.elevation_m,
    )
    items = [
        ClimateDatasetRosterItem(
            id=location.id,
            name=location.name,
            station_id=location.station_id,
            latitude=location.latitude,
            longitude=location.longitude,
            elevation_m=location.elevation_m,
            climate_zone=location.climate_zone,
            proximity=verdict,
        )
        for location, verdict in roster
    ]
    return ClimateDatasetRosterResponse(
        dataset=ClimateDatasetRef.model_validate(dataset),
        project=site,
        items=items,
        total=total,
    )


def create_project_climate_source(
    project_id: UUID,
    payload: CreateProjectClimateSourceRequest,
    user: UserPublic,
    request_meta: Request | None,
) -> ProjectClimateSourcePublic:
    with transaction() as conn:
        _validate_source(conn, project_id, payload.kind, payload.ref, payload.data)
        # PH dataset sources never trust client `data`: proximity is recomputed
        # server-side against the project site so the stored gate stays honest (D-DP-3).
        data = payload.data
        if payload.kind in ("phius", "phi"):
            data = _certification_source_data(conn, project_id, payload.kind, payload.ref)
        if payload.is_default:
            repository.clear_default(conn, project_id)
        row = repository.insert_source(
            conn,
            source_id=uuid4(),
            project_id=project_id,
            kind=payload.kind,
            ref=payload.ref,
            label=payload.label,
            is_default=payload.is_default,
            data=data,
        )
        _audit(
            conn,
            "project_climate_source_create",
            user,
            request_meta,
            project_id,
            {"source_id": str(row["id"]), "kind": payload.kind, "is_default": payload.is_default},
        )
    return ProjectClimateSourcePublic.model_validate(row)


def update_project_climate_source(
    project_id: UUID,
    source_id: UUID,
    payload: UpdateProjectClimateSourceRequest,
    user: UserPublic,
    request_meta: Request | None,
) -> ProjectClimateSourcePublic:
    values = payload.model_dump(exclude_unset=True)
    with transaction() as conn:
        existing = _load_owned_source(conn, project_id, source_id)
        if not values:
            # Nothing to change: skip re-validation and the write entirely.
            return ProjectClimateSourcePublic.model_validate(existing)
        merged_ref = values["ref"] if "ref" in values else existing["ref"]
        merged_data = values["data"] if "data" in values else existing["data"]
        _validate_source(conn, project_id, existing["kind"], merged_ref, merged_data)
        row = repository.update_source(conn, source_id, values)
        _audit(
            conn,
            "project_climate_source_update",
            user,
            request_meta,
            project_id,
            {"source_id": str(source_id), "fields": sorted(values)},
        )
    return ProjectClimateSourcePublic.model_validate(row)


def delete_project_climate_source(
    project_id: UUID,
    source_id: UUID,
    user: UserPublic,
    request_meta: Request | None,
) -> None:
    with transaction() as conn:
        _load_owned_source(conn, project_id, source_id)
        repository.delete_source(conn, source_id)
        _audit(
            conn,
            "project_climate_source_delete",
            user,
            request_meta,
            project_id,
            {"source_id": str(source_id)},
        )


def set_default_climate_source(
    project_id: UUID,
    source_id: UUID,
    user: UserPublic,
    request_meta: Request | None,
) -> ProjectClimateSourcePublic:
    with transaction() as conn:
        _load_owned_source(conn, project_id, source_id)
        # Clear the prior default before setting the new one so the
        # partial-unique index never sees two defaults mid-transaction.
        repository.clear_default(conn, project_id)
        row = repository.mark_default(conn, source_id)
        _audit(
            conn,
            "project_climate_source_set_default",
            user,
            request_meta,
            project_id,
            {"source_id": str(source_id)},
        )
    return ProjectClimateSourcePublic.model_validate(row)


def refresh_ashrae_design_conditions(
    project_id: UUID,
    payload: RefreshAshraeDesignConditionsRequest,
    user: UserPublic,
    request_meta: Request | None,
) -> ProjectClimateSourcePublic:
    with connection() as conn:
        location = location_repository.get_location(conn, project_id)
    if location is None or location["latitude"] is None or location["longitude"] is None:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "project_location_required",
            "Set the project location before pulling ASHRAE design conditions.",
        )
    result = fetch_nearest_ashrae_station_conditions(
        latitude=float(location["latitude"]),
        longitude=float(location["longitude"]),
        ashrae_version=payload.ashrae_version,
    )
    source_data = {
        "provider": "ashrae_meteo",
        "url": result.url,
        "design_conditions": result.design_conditions.model_dump(mode="json"),
        "missing_fields": result.design_conditions.missing_fields,
    }
    with transaction() as conn:
        existing = next((row for row in repository.list_sources(conn, project_id) if row["kind"] == "ashrae"), None)
        if existing is None:
            row = repository.insert_source(
                conn,
                source_id=uuid4(),
                project_id=project_id,
                kind="ashrae",
                ref=result.station_id,
                label=result.label,
                is_default=False,
                data=source_data,
            )
        else:
            row = repository.update_source(
                conn,
                existing["id"],
                {"ref": result.station_id, "label": result.label, "data": source_data},
            )
        _audit(
            conn,
            "project_climate_source_refresh_ashrae",
            user,
            request_meta,
            project_id,
            {"source_id": str(row["id"]), "ashrae_version": payload.ashrae_version},
        )
    return ProjectClimateSourcePublic.model_validate(row)


def _load_owned_source(conn: Connection[Any], project_id: UUID, source_id: UUID) -> dict[str, Any]:
    """Fetch a source and assert it belongs to the URL's project (else 404)."""
    row = repository.get_source(conn, source_id)
    if row is None or row["project_id"] != project_id:
        raise api_error(status.HTTP_404_NOT_FOUND, "climate_source_not_found", "Climate source was not found.")
    return row


def _validate_source(
    conn: Connection[Any],
    project_id: UUID,
    kind: str,
    ref: str | None,
    data: dict[str, Any] | None,
) -> None:
    """Validate a source's shape and that its referent exists.

    The shape check re-runs the model-level rules so a partial PATCH that
    produces an invalid merged shape is rejected too. Reference existence
    is checked per kind against live data.
    """
    try:
        validate_source_shape(kind, ref, data)
    except ValueError as exc:
        raise api_error(status.HTTP_422_UNPROCESSABLE_CONTENT, "climate_source_invalid", str(exc)) from exc

    if kind in ("phius", "phi"):
        location_id = _parse_ref_uuid(ref)
        provider = repository.get_dataset_location_provider(conn, location_id)
        if provider is None:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "climate_source_ref_not_found",
                "Referenced climate location was not found.",
            )
        if provider != kind:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "climate_source_provider_mismatch",
                f"Referenced location belongs to '{provider}', not '{kind}'.",
            )
    elif kind == "epw":
        _validate_epw_ref(conn, project_id, ref)
    elif kind == "custom":
        _validate_custom_record(data)
    # ashrae: `ref` is a free-text station id, `data` an optional pointer —
    # nothing to verify against live data.


def _certification_source_data(
    conn: Connection[Any],
    project_id: UUID,
    kind: PhDatasetProvider,
    ref: str | None,
) -> dict[str, Any]:
    """Recompute the server-authoritative proximity payload for a PH dataset pick.

    The stored ``data`` for a phius/phi source is always computed here from the
    project site and the referenced station — never trusted from the client
    (D-DP-3). The referent's existence/provider were already checked by
    :func:`_validate_source`; this additionally requires a project location.
    """
    location_row = climate_repository.get_location(conn, _parse_ref_uuid(ref))
    if location_row is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "climate_source_ref_not_found",
            "Referenced climate location was not found.",
        )
    location = ClimateLocationSummary.model_validate(location_row)
    dataset = climate_repository.get_dataset(conn, location.dataset_id)
    if dataset is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "climate_source_ref_not_found",
            "Referenced climate dataset was not found.",
        )
    site = _load_project_site(conn, project_id)
    payload = build_proximity_payload(
        provider=kind,
        dataset=dataset,
        location=location,
        site_latitude=site.latitude,
        site_longitude=site.longitude,
        site_elevation_m=site.elevation_m,
        auto_attached=False,
    )
    return payload.model_dump(mode="json")


def _load_project_site(conn: Connection[Any], project_id: UUID) -> RosterProjectLocation:
    """Load the project's site coordinates, raising the no-location guard when unset.

    Proximity is undefined without a site, so both the picker roster and a manual
    PH dataset attach require one. Returns the same shape the roster reports as its
    distance origin (``project``).
    """
    site = location_repository.get_location(conn, project_id)
    if site is None or site["latitude"] is None or site["longitude"] is None:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "project_location_required",
            "Set the project location before browsing or attaching a climate dataset.",
        )
    return RosterProjectLocation(
        latitude=float(site["latitude"]),
        longitude=float(site["longitude"]),
        elevation_m=float(site["elevation_m"]) if site["elevation_m"] is not None else None,
        state=site["state"],
    )


def _parse_ref_uuid(ref: str | None) -> UUID:
    try:
        return UUID(str(ref))
    except ValueError as exc:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "climate_source_ref_invalid",
            "Reference must be a climate location id.",
        ) from exc


def _validate_epw_ref(conn: Connection[Any], project_id: UUID, ref: str | None) -> None:
    asset = asset_repository.get_asset_by_id(conn, project_id, str(ref))
    if asset is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "climate_source_ref_not_found", "EPW asset was not found."
        )
    if asset.asset_kind != "epw":
        raise api_error(status.HTTP_422_UNPROCESSABLE_CONTENT, "asset_kind_mismatch", "Asset is not an EPW file.")
    if asset.upload_status != "uploaded":
        raise api_error(status.HTTP_409_CONFLICT, "asset_upload_incomplete", "Asset upload is not complete.")


def _validate_custom_record(data: dict[str, Any] | None) -> None:
    try:
        ClimateRecord.model_validate(data)
    except ValidationError as exc:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "climate_source_record_invalid",
            "Custom climate record failed validation.",
            {"errors": [str(error["msg"]) for error in exc.errors()]},
        ) from exc


def _audit(
    conn: Connection[Any],
    action: str,
    user: UserPublic,
    request_meta: Request | None,
    project_id: UUID,
    details: dict[str, object],
) -> None:
    auth_repository.log_action(
        conn,
        action=action,
        user_id=user.id,
        email=user.email,
        session_id=None,
        ip_address=client_ip(request_meta) if request_meta else None,
        user_agent=user_agent(request_meta) if request_meta else None,
        details={"project_id": str(project_id), **details},
    )
