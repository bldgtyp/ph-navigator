"""Small source-parameterized design-condition value sets."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ClimateDesignConditions(BaseModel):
    """Certification-load-bearing exterior design values, SI canonical."""

    model_config = ConfigDict(extra="forbid")

    basis: str
    source: Literal["stat", "ashrae-meteo"]
    edition: str | None = None
    heating_996_db_c: float | None = None
    heating_990_db_c: float | None = None
    cooling_004_db_c: float | None = None
    cooling_004_mcwb_c: float | None = None
    cooling_010_db_c: float | None = None
    cooling_010_mcwb_c: float | None = None
    cooling_020_db_c: float | None = None
    cooling_020_mcwb_c: float | None = None
    dehumidification_010_dp_c: float | None = None
    dehumidification_010_mcdb_c: float | None = None
    record_low_c: float | None = None
    record_high_c: float | None = None
    missing_fields: list[str] = Field(default_factory=list)
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(tz=UTC))


class EpwStatMetrics(BaseModel):
    """EPW `.stat` values cached beside the source pointer."""

    model_config = ConfigDict(extra="forbid")

    basis: str
    hdd65_f_days: float | None = None
    cdd50_f_days: float | None = None
    record_low_c: float | None = None
    record_high_c: float | None = None
    missing_fields: list[str] = Field(default_factory=list)


class ParsedStatPayload(BaseModel):
    """Normalized subset extracted from an EnergyPlus `.stat` file."""

    model_config = ConfigDict(extra="forbid")

    station_name: str | None = None
    wmo: str | None = None
    basis: str
    metrics: EpwStatMetrics
    design_conditions: ClimateDesignConditions
