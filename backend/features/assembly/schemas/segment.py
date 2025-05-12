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
