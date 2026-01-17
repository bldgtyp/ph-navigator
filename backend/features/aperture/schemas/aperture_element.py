# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from typing import Literal

from pydantic import BaseModel

from features.aperture.schemas.aperture_element_frame import ApertureElementFramesSchema
from features.aperture.schemas.aperture_element_glazing import ApertureElementGlazingSchema


class OperationSchema(BaseModel):
    """Schema for window element operation (swing/slide)."""

    type: Literal["swing", "slide"]
    directions: list[Literal["left", "right", "up", "down"]]


class ApertureElementSchema(BaseModel):
    """Base schema for Aperture Element."""

    id: int
    name: str | None = "Unnamed"
    row_number: int
    column_number: int
    row_span: int = 1
    col_span: int = 1
    glazing: ApertureElementGlazingSchema
    frames: ApertureElementFramesSchema
    operation: OperationSchema | None = None

    class Config:
        orm_mode = True


class UpdateOperationRequest(BaseModel):
    """Request schema for updating element operation."""

    operation: OperationSchema | None = None  # None = set to fixed
