"""Top-level `/model_data` response schema (US-VIEW-7 crit. 3)."""

from __future__ import annotations

from pydantic import BaseModel, Field

from features.model_viewer.schemas.honeybee import FaceSchema, ShadeGroupSchema
from features.model_viewer.schemas.honeybee_ph import SpaceSchema
from features.model_viewer.schemas.honeybee_phhvac import (
    PhHotWaterSystemSchema,
    PhVentilationSystemSchema,
)
from features.model_viewer.schemas.ladybug import SunPathAndCompassDTOSchema


class LoadSummarySchema(BaseModel):
    """Extraction tallies surfaced in the viewer's scene-info popover.

    `air_boundaries_skipped` makes V1's silent AirBoundary drop explicit
    (Q-VIEW-1). Warnings are non-fatal anomalies — extraction never fails
    on them.
    """

    air_boundaries_skipped: int = 0
    faces_extracted: int = 0
    spaces_extracted: int = 0
    shade_groups_extracted: int = 0
    extraction_warnings: list[str] = Field(default_factory=list)


class CombinedModelDataSchema(BaseModel):
    """Everything the 3D viewer needs, in one payload, SI canonical.

    Precomputed at upload and served as an immutable R2 artifact (D-15);
    the viewer makes exactly one data call. `sun_path` stays null until
    model-viewer wires project-location data into extraction (D-07).
    """

    faces: list[FaceSchema]
    spaces: list[SpaceSchema]
    sun_path: SunPathAndCompassDTOSchema | None = None
    hot_water_systems: list[PhHotWaterSystemSchema]
    ventilation_systems: list[PhVentilationSystemSchema]
    shading_elements: list[ShadeGroupSchema]
    load_summary: LoadSummarySchema
