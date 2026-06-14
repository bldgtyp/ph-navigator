"""Read + seed workflow for the app-wide climate reference datasets.

Reads back the list/search/detail projections the API and MCP expose.
The seed routine is the re-runnable entry point that turns parsed
``ClimateRecord`` objects into stored rows; importers
(:mod:`features.climate.importers`) produce the records, this owns
persistence and idempotency.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

from starlette import status

from database import connection, transaction
from features.climate import repository
from features.climate.models import (
    ClimateDatasetListResponse,
    ClimateDatasetPublic,
    ClimateLocationDetail,
    ClimateLocationListResponse,
    ClimateLocationSummary,
)
from features.climate.record import ClimateRecord
from features.shared.errors import api_error

# Hard cap on a single location-search page, mirroring the catalog list
# conventions: keeps a stray `limit=100000` from materializing the whole
# dataset into one response.
_MAX_PAGE_SIZE = 500


@dataclass(frozen=True)
class SeedResult:
    """Outcome of a single :func:`seed_dataset` call."""

    dataset_id: UUID
    provider: str
    version: str
    location_count: int
    replaced: bool


def list_climate_datasets() -> ClimateDatasetListResponse:
    with connection() as conn:
        rows = repository.list_datasets(conn)
    return ClimateDatasetListResponse(items=[ClimateDatasetPublic.model_validate(row) for row in rows])


def search_climate_locations(
    dataset_id: UUID,
    *,
    country: str | None,
    region: str | None,
    near: tuple[float, float] | None,
    limit: int,
    offset: int,
) -> ClimateLocationListResponse:
    """List/search a dataset's locations.

    ``near=(lat, long)`` switches to nearest-station ranking (and ignores
    paging beyond ``limit``); otherwise results are filtered by
    country/region and paginated. Raises 404 when the dataset is unknown.
    """
    bounded_limit = max(1, min(limit, _MAX_PAGE_SIZE))
    with connection() as conn:
        if repository.get_dataset(conn, dataset_id) is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "climate_dataset_not_found", "Climate dataset was not found.")
        if near is not None:
            latitude, longitude = near
            rows = repository.nearest_locations(
                conn, dataset_id, latitude=latitude, longitude=longitude, limit=bounded_limit
            )
            total = len(rows)
        else:
            rows = repository.search_locations(
                conn, dataset_id, country=country, region=region, limit=bounded_limit, offset=max(0, offset)
            )
            total = repository.count_locations(conn, dataset_id, country=country, region=region)
    return ClimateLocationListResponse(
        items=[ClimateLocationSummary.model_validate(row) for row in rows],
        total=total,
    )


def get_climate_location(location_id: UUID) -> ClimateLocationDetail | None:
    """Return one location's summary + standardized record, or None."""
    with connection() as conn:
        row = repository.get_location(conn, location_id)
    if row is None:
        return None
    return ClimateLocationDetail.model_validate({**row, "record": row["data"]})


def seed_dataset(
    provider: str,
    version: str,
    records: Iterable[ClimateRecord],
    *,
    label: str | None = None,
    source: str | None = None,
    replace: bool = True,
) -> SeedResult:
    """Seed (or re-seed) one provider/version reference dataset.

    Idempotent per ``(provider, version)``: if that release already
    exists and ``replace`` is True the old dataset (and its locations,
    via cascade) is dropped and rebuilt; with ``replace`` False an
    existing release is left untouched. The whole rebuild runs in one
    transaction so a failed import never leaves a half-seeded dataset.
    """
    with transaction() as conn:
        existing = repository.get_dataset_by_provider_version(conn, provider, version)
        if existing is not None:
            if not replace:
                return SeedResult(
                    dataset_id=existing["id"],
                    provider=provider,
                    version=version,
                    location_count=int(existing["location_count"]),
                    replaced=False,
                )
            repository.delete_dataset(conn, existing["id"])

        dataset_id = uuid4()
        repository.insert_dataset(
            conn, dataset_id=dataset_id, provider=provider, version=version, label=label, source=source
        )
        count = 0
        for record in records:
            summary = _location_summary(record)
            repository.insert_location(
                conn,
                location_id=uuid4(),
                dataset_id=dataset_id,
                data=record.model_dump(mode="json"),
                **summary,
            )
            count += 1

    return SeedResult(
        dataset_id=dataset_id,
        provider=provider,
        version=version,
        location_count=count,
        replaced=existing is not None,
    )


def _location_summary(record: ClimateRecord) -> dict[str, Any]:
    """Project the searchable summary columns out of a standardized record.

    These columns drive list/search/nearest queries; the authoritative
    values stay in the ``data`` JSONB. ``climate_zone`` is left null —
    the PH datasets identify by country/region/dataset-name, not a single
    text zone — but the column stays available for sources that have one.
    """
    name = record.display_name or record.phpp_codes.dataset_name or record.station_id or "(unnamed)"
    return {
        "name": name,
        "country": record.phpp_codes.country_code or None,
        "region": record.phpp_codes.region_code or None,
        "climate_zone": None,
        "latitude": record.location.latitude,
        "longitude": record.location.longitude,
        "elevation_m": record.location.site_elevation_m,
        "station_id": record.station_id,
    }
