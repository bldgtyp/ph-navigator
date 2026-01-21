# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: honeybee_ph.space"""


from pydantic.main import BaseModel

from ..ladybug_geometry.geometry3d.face3d import Face3DSchema
from .properties.space import SpacePropertiesSchema


class SpaceFloorSegmentSchema(BaseModel):
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
    identifier: str
    quantity: int
    name: str
    number: str
    volumes: list[SpaceVolumeSchema]

    properties: SpacePropertiesSchema

    # -- Additional Properties
    net_volume: float = 0.0
    floor_area: float = 0.0
    weighted_floor_area: float = 0.0
    avg_clear_height: float = 0.0
    average_floor_weighting_factor: float = 0.0
