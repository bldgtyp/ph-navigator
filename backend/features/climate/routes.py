"""Climate reference-dataset API routes.

These datasets are app-wide / global (not project-scoped), mirroring the
catalog routes: reads require an authenticated user, nothing finer. The
project-scoped sun-path endpoint lives separately on the
``project_location`` router (Climate Phase 1).
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query
from starlette import status

from features.auth.routes import CurrentUser
from features.climate._shared import parse_lat_long
from features.climate.models import (
    ClimateDatasetListResponse,
    ClimateLocationDetail,
    ClimateLocationListResponse,
)
from features.climate.service import (
    get_climate_location,
    list_climate_datasets,
    search_climate_locations,
)
from features.shared.errors import api_error

router = APIRouter(prefix="/api/v1/climate", tags=["climate"])


@router.get("/datasets", response_model=ClimateDatasetListResponse)
def get_datasets(auth: CurrentUser) -> ClimateDatasetListResponse:
    del auth
    return list_climate_datasets()


@router.get("/datasets/{dataset_id}/locations", response_model=ClimateLocationListResponse)
def get_dataset_locations(
    dataset_id: UUID,
    auth: CurrentUser,
    country: Annotated[str | None, Query()] = None,
    region: Annotated[str | None, Query()] = None,
    near: Annotated[str | None, Query(description="`lat,long` — switches to nearest-station ranking")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ClimateLocationListResponse:
    del auth
    return search_climate_locations(
        dataset_id,
        country=country,
        region=region,
        near=_parse_near(near),
        limit=limit,
        offset=offset,
    )


@router.get("/datasets/{dataset_id}/locations/{location_id}", response_model=ClimateLocationDetail)
def get_dataset_location(dataset_id: UUID, location_id: UUID, auth: CurrentUser) -> ClimateLocationDetail:
    del auth, dataset_id  # location ids are globally unique; dataset_id keeps the URL hierarchical
    detail = get_climate_location(location_id)
    if detail is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "climate_location_not_found", "Climate location was not found.")
    return detail


def _parse_near(near: str | None) -> tuple[float, float] | None:
    """Parse a ``lat,long`` query string into a coordinate pair, or None."""
    if near is None:
        return None
    try:
        return parse_lat_long(near)
    except ValueError as exc:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "climate_near_invalid", "`near` must be `lat,long` numbers."
        ) from exc
