# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from ph_units.converter import convert
from ph_units.parser import parse_input
from pydantic import BaseModel, ConfigDict, field_validator

from features.assembly.schemas.segment import SegmentSchema


class LayerSchemaBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order: int
    assembly_id: int
    thickness_mm: float
    segments: list[SegmentSchema] = []

    @property
    def is_steel_stud_layer(self) -> bool:
        """Check if the layer has any Steel-Stud segments."""
        return any([s.steel_stud_spacing_mm is not None for s in self.segments])

    @property
    def is_continuous_insulation_layer(self) -> bool:
        """Check if the layer has any Continuous Insulation segments."""
        return any([s.is_continuous_insulation for s in self.segments])


class LayerSchema(LayerSchemaBase):
    id: int


class CreateLayerRequest(BaseModel):
    order: int


class UpdateLayerHeightRequest(BaseModel):
    thickness_mm: float

    @field_validator("thickness_mm", mode="before")
    @classmethod
    def validate_thickness(cls, v: str | float) -> float:
        input_value, input_unit = parse_input(v)
        thickness_mm = convert(input_value, input_unit or "MM", "MM")

        if not thickness_mm:
            raise ValueError(f"Error getting Layer Thickness from input: {thickness_mm}.")

        if thickness_mm <= 0:
            raise ValueError("Layer thickness must be greater than 0.")

        return thickness_mm
