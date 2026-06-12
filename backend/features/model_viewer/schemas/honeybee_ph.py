"""Pydantic mirrors of honeybee_ph Space / Volume / Floor / FloorSegment.

Airflow fields are SI canonical — m³/s on the wire (US-VIEW-7 crit. 1).
V1's pre-Pydantic ×3600 conversion is deliberately NOT ported; the
frontend converts to m³/h or CFM at display time.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from features.model_viewer.schemas.ladybug_geometry import Face3DSchema


class SpacePhPropertiesSchema(BaseModel):
    """`space.properties.ph` extension.

    The underscore-prefixed wire aliases mirror honeybee_ph's
    `Space.to_dict()` keys (and V1's wire) — artifact serialization uses
    `by_alias=True` so the frontend reads `properties.ph._v_sup` etc.
    """

    model_config = ConfigDict(populate_by_name=True)

    id_num: int | None = None
    type: str | None = None
    v_eta: float | None = Field(default=None, alias="_v_eta", description="Extract airflow, m³/s")
    v_sup: float | None = Field(default=None, alias="_v_sup", description="Supply airflow, m³/s")
    v_tran: float | None = Field(default=None, alias="_v_tran", description="Transfer airflow, m³/s")


class SpacePropertiesSchema(BaseModel):
    """`space.properties` extension bag."""

    energy: Any = None
    ph: SpacePhPropertiesSchema | None = None


class SpaceFloorSegmentSchema(BaseModel):
    """The unit colored by the Weighting Factor theme (US-VIEW-5)."""

    identifier: str
    display_name: str
    geometry: Face3DSchema | None = None
    weighting_factor: float
    floor_area: float | None = 0.0
    weighted_floor_area: float | None = 0.0


class SpaceFloorSchema(BaseModel):
    identifier: str
    display_name: str
    floor_segments: list[SpaceFloorSegmentSchema]
    geometry: Face3DSchema


class SpaceVolumeSchema(BaseModel):
    identifier: str
    display_name: str
    avg_ceiling_height: float
    floor: SpaceFloorSchema
    geometry: list[Face3DSchema]


class SpaceSchema(BaseModel):
    """honeybee_ph PH-Space with service-computed aggregates attached.

    `wufi_type` was absent from V1's backend schema even though V1's
    frontend declared and displayed it — V2 ships it for real.
    """

    identifier: str
    quantity: int
    name: str
    number: str
    wufi_type: int
    volumes: list[SpaceVolumeSchema]
    properties: SpacePropertiesSchema

    # Computed by the extraction service from the live honeybee_ph Space
    # (not present in `Space.to_dict()`).
    net_volume: float = 0.0
    floor_area: float = 0.0
    weighted_floor_area: float = 0.0
    avg_clear_height: float = 0.0
    average_floor_weighting_factor: float = 0.0
