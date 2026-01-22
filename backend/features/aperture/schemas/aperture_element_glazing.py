# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from features.aperture.schemas.glazing_type import GlazingTypeSchema
from pydantic import BaseModel


class ApertureElementGlazingSchema(BaseModel):
    """Base schema for Aperture Element Glazing."""

    id: int
    name: str = "Unnamed Glazing Type"
    glazing_type: GlazingTypeSchema

    class Config:
        orm_mode = True
