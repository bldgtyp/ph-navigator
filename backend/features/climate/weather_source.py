"""Build the project ``weather`` source from a downloaded EPW + STAT bundle.

Neutral home for the EPW-bundle → ``project_climate_source`` payload builder so
both consumers — the nearest auto-derive (``project_location.service``) and the
map-picker from-catalog attach (``project_climate_source.service``) — import it
without an import cycle.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from starlette import status

from features.assets.schemas import AssetRow
from features.assets.service import AssetService
from features.auth.models import UserPublic
from features.climate.design_conditions import ParsedStatPayload
from features.climate.epw_catalog import EpwZipPayload
from features.climate.stat_parser import parse_stat_file
from features.project_location.epw import EPW_HEADER_PREFIX_BYTES, parse_epw_location_header
from features.project_location.models import EpwParsedLocation
from features.projects.access import ProjectAccess
from features.shared.errors import api_error

# `.stat` files are tens of KB; a generous prefix reads the whole thing in one
# ranged object-store GET (the asset service only exposes a prefix read).
_STAT_READ_BYTES = 512 * 1024


def build_weather_source_payload(
    project_id: UUID,
    user: UserPublic,
    asset_service: AssetService,
    epw_payload: EpwZipPayload,
) -> dict[str, Any]:
    """Store the EPW bytes and build the single ``weather`` source upsert payload.

    The weather source carries the EPW asset pointer (``ref``) plus the
    STAT-derived metrics and ASHRAE design conditions in ``data`` — one record
    for the whole EPW + STAT bundle.
    """
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
    weather_data: dict[str, object] = {
        "provider": "onebuilding",
        "source_url": epw_payload.entry.url,
        "stat_filename": epw_payload.stat_name,
        "station": _station_dict(
            name=epw_payload.entry.name,
            country=epw_payload.entry.country,
            region=epw_payload.entry.region,
            wmo=epw_payload.entry.wmo,
            latitude=epw_payload.entry.latitude,
            longitude=epw_payload.entry.longitude,
            elevation_m=epw_payload.entry.elevation_m,
            distance_mi=epw_payload.entry.distance_mi,
        ),
        "fetched_at": fetched_at,
    }
    if stat_payload is not None:
        _apply_stat_payload(weather_data, stat_payload)
    return {
        "kind": "weather",
        "ref": asset.id,
        "label": epw_payload.entry.name,
        "data": weather_data,
    }


def build_weather_source_from_upload(
    access: ProjectAccess,
    asset_service: AssetService,
    *,
    epw_asset_id: str,
    stat_asset_id: str | None,
    ddy_asset_id: str | None,
) -> dict[str, Any]:
    """Build the ``weather`` source from already-uploaded EPW / STAT / DDY assets.

    The EPW is required (its header supplies the station); the ``.stat`` (if
    given) is parsed into the metrics + design conditions; the ``.ddy`` is stored
    by id only (D5). Mirrors the ``data`` shape of
    :func:`build_weather_source_payload` so the page renders identically whether
    the source was derived, catalog-picked, or uploaded.
    """
    epw_asset, epw_prefix = asset_service.read_asset_prefix(access, epw_asset_id, EPW_HEADER_PREFIX_BYTES)
    _require_asset_kind(epw_asset, "epw")
    try:
        epw_location = parse_epw_location_header(epw_prefix)
    except ValueError as exc:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "epw_location_header_invalid",
            "EPW LOCATION header could not be parsed.",
        ) from exc

    station_name = _station_label(epw_location) or epw_asset.original_filename
    weather_data: dict[str, object] = {
        "provider": "upload",
        "source_url": None,
        "station": _station_dict(
            name=station_name,
            country=epw_location.country,
            region=epw_location.state,
            wmo=epw_location.wmo,
            latitude=epw_location.latitude,
            longitude=epw_location.longitude,
            elevation_m=epw_location.elevation_m,
            distance_mi=None,
        ),
    }
    if stat_asset_id:
        stat_asset, stat_bytes = asset_service.read_asset_prefix(access, stat_asset_id, _STAT_READ_BYTES)
        _require_asset_kind(stat_asset, "stat")
        stat_payload = parse_stat_file(stat_bytes.decode("utf-8-sig", errors="replace"))
        weather_data["stat_filename"] = stat_asset.original_filename
        weather_data["stat_asset_id"] = stat_asset_id
        _apply_stat_payload(weather_data, stat_payload)
    if ddy_asset_id:
        ddy_asset = asset_service.get_asset(access, ddy_asset_id)
        _require_asset_kind(ddy_asset, "ddy")
        if ddy_asset.upload_status != "uploaded":
            raise api_error(status.HTTP_409_CONFLICT, "asset_upload_incomplete", "DDY asset upload is not complete.")
        weather_data["ddy_asset_id"] = ddy_asset_id
    return {"kind": "weather", "ref": epw_asset_id, "label": station_name, "data": weather_data}


def _station_dict(
    *,
    name: str,
    country: str | None,
    region: str | None,
    wmo: str | None,
    latitude: float | None,
    longitude: float | None,
    elevation_m: float | None,
    distance_mi: float | None,
) -> dict[str, object]:
    """The station metadata block shared by every weather-source builder."""
    return {
        "name": name,
        "country": country,
        "region": region,
        "wmo": wmo,
        "latitude": latitude,
        "longitude": longitude,
        "elevation_m": elevation_m,
        "distance_mi": distance_mi,
    }


def _apply_stat_payload(weather_data: dict[str, object], stat_payload: ParsedStatPayload) -> None:
    """Populate the STAT-derived metrics + design conditions onto a weather payload."""
    weather_data["stat_metrics"] = stat_payload.metrics.model_dump(mode="json")
    weather_data["design_conditions"] = stat_payload.design_conditions.model_dump(mode="json")


def _require_asset_kind(asset: AssetRow, kind: str) -> None:
    if asset.asset_kind != kind:
        raise api_error(status.HTTP_422_UNPROCESSABLE_CONTENT, "asset_kind_mismatch", f"Asset is not a .{kind} file.")


def _station_label(location: EpwParsedLocation) -> str | None:
    label = ", ".join(part for part in (location.city, location.state) if part)
    return label or None
