# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: honeybee_phhvac.hot_water_piping"""

from typing import Any

from pydantic import BaseModel

from ..ladybug_geometry.geometry3d.line import LineSegment3DSchema


class PhHvacPipeSegmentSchema(BaseModel):
    geometry: LineSegment3DSchema
    diameter_mm: float
    insulation_thickness_mm: float
    insulation_conductivity: float
    insulation_reflective: bool
    insulation_quality: Any = None
    daily_period: float
    water_temp_c: float
    material_value: str
    length: float


class PhHvacPipeElementSchema(BaseModel):
    identifier: str
    display_name: str
    user_data: dict
    segments: dict[str, PhHvacPipeSegmentSchema]


class PhHvacPipeBranchSchema(BaseModel):
    identifier: str
    display_name: str
    user_data: dict
    pipe_element: PhHvacPipeElementSchema
    fixtures: dict[str, PhHvacPipeElementSchema]


class PhHvacPipeTrunkSchema(BaseModel):
    identifier: str
    display_name: str
    user_data: dict
    pipe_element: PhHvacPipeElementSchema
    branches: dict[str, PhHvacPipeBranchSchema]
    multiplier: float
