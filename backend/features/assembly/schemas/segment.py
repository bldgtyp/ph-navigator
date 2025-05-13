# -*- Python Version: 3.11 (Render.com) -*-

from __future__ import annotations  # Enables forward references

import re

from pydantic import BaseModel, root_validator

from features.assembly.schemas.material import MaterialSchema


class AssemblyLayerSegmentSchema(BaseModel):
    id: int
    layer_id: int
    material_id: str
    order: int
    width_mm: float
    material: MaterialSchema
    steel_stud_spacing_mm: float | None = None

    class Config:
        orm_mode = True


class CreateLayerSegmentRequest(BaseModel):
    layer_id: int
    material_id: str
    width_mm: float
    order: int


class UpdateSegmentMaterialRequest(BaseModel):
    material_id: str


class UpdateSegmentWidthRequest(BaseModel):
    width_mm: float

    @root_validator(pre=True)
    def check_width(cls, values):
        width_mm = values.get("width_mm")
        if width_mm <= 0:
            raise ValueError("Segment width must be greater than 0.")
        return values


class UpdateSegmentSteelStudSpacingRequest(BaseModel):
    steel_stud_spacing_mm: float | None = None

    @root_validator(pre=True)
    def check_steel_stud_spacing(cls, values):
        steel_stud_spacing_mm = values.get("steel_stud_spacing_mm")
        if steel_stud_spacing_mm and steel_stud_spacing_mm <= 0:
            raise ValueError("Steel stud spacing must be greater than 0.")
        return values