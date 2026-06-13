"""API wire contracts for the app-wide climate reference datasets.

The heavyweight standardized record lives in :mod:`features.climate.record`
(``ClimateRecord``); this module holds the small list/search projections
the dataset endpoints return. Location search returns a lightweight
summary; the full ``ClimateRecord`` is fetched per-location on demand.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from features.climate.record import ClimateRecord


class ClimateDatasetPublic(BaseModel):
    """One reference dataset version (e.g. Phius 2022, PHI/PHPP 10.6)."""

    model_config = ConfigDict(extra="ignore")

    id: UUID
    provider: str
    version: str
    label: str | None
    source: str | None
    created_at: datetime
    location_count: int


class ClimateDatasetListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ClimateDatasetPublic]


class ClimateLocationSummary(BaseModel):
    """List/search projection — identity + coordinates, not the full record."""

    model_config = ConfigDict(extra="ignore")

    id: UUID
    dataset_id: UUID
    name: str
    country: str | None
    region: str | None
    climate_zone: str | None
    latitude: float | None
    longitude: float | None
    elevation_m: float | None
    station_id: str | None


class ClimateLocationListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ClimateLocationSummary]
    total: int


class ClimateLocationDetail(ClimateLocationSummary):
    """A single location's summary plus its standardized climate record."""

    model_config = ConfigDict(extra="ignore")

    record: ClimateRecord
