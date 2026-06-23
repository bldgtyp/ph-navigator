"""Workflow rules for project-scoped climate sources.

Reads go through :func:`list_project_climate_sources`; mutations run in a
single transaction, validate the source shape (and that any referenced
reference-dataset location / EPW asset actually exists), and append an
audit-log entry — mirroring the ``project_location`` service.
"""

from __future__ import annotations

from typing import Any, cast
from uuid import UUID, uuid4

from fastapi import Request
from psycopg import Connection
from pydantic import ValidationError
from starlette import status

from database import connection, transaction
from features.assets import repository as asset_repository
from features.assets.service import AssetService
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import client_ip, user_agent
from features.climate import repository as climate_repository
from features.climate.ashrae_meteo import fetch_nearest_ashrae_station_conditions
from features.climate.epw_catalog import (
    download_epw_zip,
    epw_entries_for_region,
    epw_version_label,
    find_entry_by_url,
    nearest_epw_entries,
)
from features.climate.models import ClimateLocationSummary
from features.climate.proximity import (
    PhDatasetProvider,
    build_location_roster,
    build_proximity_payload,
    elevation_delta_ft,
)
from features.climate.record import ClimateRecord
from features.climate.weather_source import build_weather_source_from_upload, build_weather_source_payload
from features.project_climate_source import repository
from features.project_climate_source.models import (
    ClimateDatasetRef,
    ClimateDatasetRosterItem,
    ClimateDatasetRosterResponse,
    CreateProjectClimateSourceRequest,
    EpwRosterItem,
    EpwRosterResponse,
    ProjectClimateSourceListResponse,
    ProjectClimateSourcePublic,
    RefreshAshraeDesignConditionsRequest,
    RosterProjectLocation,
    UpdateProjectClimateSourceRequest,
    validate_source_shape,
)
from features.project_location import repository as location_repository
from features.projects.access import ProjectAccess
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
            region=location.region,
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


# v1 weather picker is USA + state filter (D4); the catalog tags US rows "USA".
_WEATHER_CATALOG_COUNTRY = "USA"


def get_project_epw_roster(
    project_id: UUID,
    *,
    region: str | None,
    near: bool,
    limit: int,
) -> EpwRosterResponse:
    """The weather picker feed: OneBuilding EPW stations for a project, nearest-first.

    Resolves the project site (raising the no-location guard when unset), then
    filters the cached catalog by ``region`` (defaulting to the site's state) or,
    when ``near`` is set, takes the nearest ``limit`` across the USA. The picker
    shows every dataset version per station (TMYx periods, TMY3, …), so a state's
    full roster is returned uncapped; only the cross-USA nearest sweep is limited.
    Distance + elevation delta are informational — no certification verdict (D4).
    """
    with connection() as conn:
        site = _load_project_site(conn, project_id)

    if near:
        entries = nearest_epw_entries(site.latitude, site.longitude, country=_WEATHER_CATALOG_COUNTRY, limit=limit)
    else:
        effective_region = region if region is not None else site.state
        entries = epw_entries_for_region(
            country=_WEATHER_CATALOG_COUNTRY,
            region=effective_region,
            latitude=site.latitude,
            longitude=site.longitude,
            limit=None,
        )
    items = [
        EpwRosterItem(
            name=entry.name,
            wmo=entry.wmo,
            region=entry.region,
            latitude=entry.latitude,
            longitude=entry.longitude,
            elevation_m=entry.elevation_m,
            distance_mi=round(entry.distance_mi, 1) if entry.distance_mi is not None else None,
            elevation_delta_ft=elevation_delta_ft(site.elevation_m, entry.elevation_m),
            source_url=entry.url,
            version_label=epw_version_label(entry.url),
        )
        for entry in entries
    ]
    return EpwRosterResponse(project=site, items=items, total=len(items))


def attach_weather_source_from_catalog(
    project_id: UUID,
    url: str,
    user: UserPublic,
    request_meta: Request | None,
    asset_service: AssetService,
) -> ProjectClimateSourcePublic:
    """Attach a specific OneBuilding station picked from the map.

    Downloads + parses + stores the chosen catalog entry exactly as the nearest
    auto-derive does, producing the single ``weather`` source.
    """
    entry = find_entry_by_url(url)
    if entry is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "epw_catalog_entry_not_found",
            "The selected weather station is no longer in the catalog.",
        )
    payload = download_epw_zip(entry)
    source = build_weather_source_payload(project_id, user, asset_service, payload)
    with transaction() as conn:
        attach_weather_source(conn, project_id=project_id, source=source)
        # Parity with the nearest-derive path: the weather source is the project EPW.
        location_repository.upsert_location(
            conn,
            project_id,
            {"epw_asset_id", "epw_source_url"},
            {"epw_asset_id": str(source["ref"]), "epw_source_url": entry.url},
        )
        row = repository.get_source_by_kind(conn, project_id, "weather")
        _audit(
            conn,
            "project_climate_source_attach_from_catalog",
            user,
            request_meta,
            project_id,
            {"source_id": str(row["id"]) if row else None, "url": url},
        )
    return ProjectClimateSourcePublic.model_validate(row)


def attach_weather_source_from_upload(
    access: ProjectAccess,
    *,
    epw_asset_id: str,
    stat_asset_id: str | None,
    ddy_asset_id: str | None,
    user: UserPublic,
    request_meta: Request | None,
    asset_service: AssetService,
) -> ProjectClimateSourcePublic:
    """Attach a manually-uploaded EPW + STAT + DDY bundle as the weather source.

    The assets are already stored (uploaded by the client); this validates them,
    parses the EPW header + STAT, and upserts the single ``weather`` source.
    """
    project_id = access.project_id
    source = build_weather_source_from_upload(
        access,
        asset_service,
        epw_asset_id=epw_asset_id,
        stat_asset_id=stat_asset_id,
        ddy_asset_id=ddy_asset_id,
    )
    with transaction() as conn:
        attach_weather_source(conn, project_id=project_id, source=source)
        # Parity with the derive / from-catalog paths: the weather source is the project EPW.
        location_repository.upsert_location(conn, project_id, {"epw_asset_id"}, {"epw_asset_id": epw_asset_id})
        row = repository.get_source_by_kind(conn, project_id, "weather")
        _audit(
            conn,
            "project_climate_source_attach_from_upload",
            user,
            request_meta,
            project_id,
            {"source_id": str(row["id"]) if row else None, "epw_asset_id": epw_asset_id},
        )
    return ProjectClimateSourcePublic.model_validate(row)


def upsert_source_by_kind(
    conn: Connection[Any],
    *,
    project_id: UUID,
    kind: str,
    ref: str | None,
    label: str | None,
    data: dict[str, Any],
) -> dict[str, Any]:
    """Insert a source for a kind, or update the existing one in place.

    The one-source-per-kind path shared by the address-derived auto-attach
    (Phius/PHI/weather) and the manual PH dataset picker: a project holds at
    most one source per such kind, so re-attaching replaces rather than
    duplicates.
    """
    existing = repository.get_source_by_kind(conn, project_id, kind)
    if existing is None:
        return repository.insert_source(
            conn,
            source_id=uuid4(),
            project_id=project_id,
            kind=kind,
            ref=ref,
            label=label,
            data=data,
        )
    return repository.update_source(conn, existing["id"], {"ref": ref, "label": label, "data": data})


def attach_weather_source(
    conn: Connection[Any],
    *,
    project_id: UUID,
    source: dict[str, object],
) -> None:
    """Upsert a built weather-source payload (the inverse of ``build_weather_source_payload``)."""
    upsert_source_by_kind(
        conn,
        project_id=project_id,
        kind=str(source["kind"]),
        ref=str(source["ref"]),
        label=str(source["label"]),
        data=cast(dict[str, Any], source["data"] if isinstance(source["data"], dict) else {}),
    )


def create_project_climate_source(
    project_id: UUID,
    payload: CreateProjectClimateSourceRequest,
    user: UserPublic,
    request_meta: Request | None,
) -> ProjectClimateSourcePublic:
    with transaction() as conn:
        _validate_source(conn, project_id, payload.kind, payload.ref, payload.data)
        if payload.kind in ("phius", "phi"):
            # PH dataset sources are one-per-kind: recompute proximity server-side
            # (never trust client `data`, D-DP-3) and replace any existing source of
            # this kind, so the picker's "Replace dataset" reuses the create path.
            data = _certification_source_data(conn, project_id, payload.kind, payload.ref)
            row = upsert_source_by_kind(
                conn,
                project_id=project_id,
                kind=payload.kind,
                ref=payload.ref,
                label=payload.label or str(data["location_name"]),
                data=data,
            )
        else:
            row = repository.insert_source(
                conn,
                source_id=uuid4(),
                project_id=project_id,
                kind=payload.kind,
                ref=payload.ref,
                label=payload.label,
                data=payload.data,
            )
        _audit(
            conn,
            "project_climate_source_create",
            user,
            request_meta,
            project_id,
            {"source_id": str(row["id"]), "kind": payload.kind},
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


def refresh_ashrae_design_conditions(
    project_id: UUID,
    payload: RefreshAshraeDesignConditionsRequest,
    user: UserPublic,
    request_meta: Request | None,
) -> ProjectClimateSourcePublic:
    """Replace the weather source's design conditions with a current ASHRAE edition.

    The design conditions live on the project's one ``weather`` source (the EPW
    bundle), so this updates that source in place rather than creating a separate
    record — the weather file must already be set (409 otherwise).
    """
    with connection() as conn:
        location = location_repository.get_location(conn, project_id)
        weather = repository.get_source_by_kind(conn, project_id, "weather")
    if location is None or location["latitude"] is None or location["longitude"] is None:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "project_location_required",
            "Set the project location before pulling ASHRAE design conditions.",
        )
    # Fail fast — before the network fetch — when there is no weather file to update.
    if weather is None:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "weather_source_required",
            "Set the weather file before pulling current ASHRAE design conditions.",
        )
    result = fetch_nearest_ashrae_station_conditions(
        latitude=float(location["latitude"]),
        longitude=float(location["longitude"]),
        ashrae_version=payload.ashrae_version,
    )
    data = dict(weather["data"]) if isinstance(weather["data"], dict) else {}
    data["design_conditions"] = result.design_conditions.model_dump(mode="json")
    data["design_conditions_source"] = {
        "provider": "ashrae_meteo",
        "url": result.url,
        "station_id": result.station_id,
        "missing_fields": result.design_conditions.missing_fields,
    }
    with transaction() as conn:
        row = repository.update_source(conn, weather["id"], {"data": data})
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
    elif kind == "weather":
        _validate_weather_ref(conn, project_id, ref)
    elif kind == "custom":
        _validate_custom_record(data)


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


def _validate_weather_ref(conn: Connection[Any], project_id: UUID, ref: str | None) -> None:
    """A weather source's ``ref`` is its primary EPW file asset (the bundle's
    `.stat` / `.ddy` asset ids ride in ``data``)."""
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
