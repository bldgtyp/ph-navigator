# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel

from features.aperture.schemas.frame import ApertureElementFramesSchema
from features.aperture.schemas.glazing import ApertureElementGlazingSchema


class ApertureElementSchema(BaseModel):
    """Base schema for Aperture Element."""

    id: int
    name: str | None = "Unnamed Aperture-Element"
    row_number: int
    column_number: int
    row_span: int = 1
    col_span: int = 1
    glazing: ApertureElementGlazingSchema | None = None
    frames: ApertureElementFramesSchema

    class Config:
        orm_mode = True
