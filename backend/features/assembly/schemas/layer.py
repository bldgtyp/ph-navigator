# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel, root_validator

from features.assembly.schemas.segment import AssemblyLayerSegmentSchema


class AssemblyLayerSchemaBase(BaseModel):
    order: int
    assembly_id: int
    thickness_mm: float
    segments: list[AssemblyLayerSegmentSchema] = []

    class Config:
        orm_mode = True

    @property
    def is_steel_stud_layer(self) -> bool:
        """Check if the layer has any Steel-Stud segments."""
        return any([s.steel_stud_spacing_mm is not None for s in self.segments])

    @property
    def is_continuous_insulation_layer(self) -> bool:
        """Check if the layer has any Continuous Insulation segments."""
        return any([s.is_continuous_insulation for s in self.segments])


class AssemblyLayerSchema(AssemblyLayerSchemaBase):
    id: int


class CreateLayerRequest(BaseModel):
    assembly_id: int
    thickness_mm: float
    order: int

    @root_validator(pre=True)
    def check_height(cls, values):
        thickness_mm = values.get("thickness_mm")
        if thickness_mm <= 0:
            raise ValueError("Layer thickness must be greater than 0.")
        return values


class UpdateLayerHeightRequest(BaseModel):
    thickness_mm: float

    @root_validator(pre=True)
    def check_height(cls, values):
        thickness_mm = values.get("thickness_mm")
        if thickness_mm <= 0:
            raise ValueError("Layer thickness must be greater than 0.")
        return values
