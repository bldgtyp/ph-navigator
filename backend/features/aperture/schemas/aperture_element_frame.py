# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel


class ApertureElementFrameSchema(BaseModel):
    """Base schema for Aperture Element Frame."""

    id: int
    name: str = "Unnamed Frame"
    width_mm: float
    u_value_w_m2k: float

    class Config:
        orm_mode = True


class ApertureElementFramesSchema(BaseModel):
    """Base schema for Aperture Element Frames Collection."""

    top: ApertureElementFrameSchema | None = None
    right: ApertureElementFrameSchema | None = None
    bottom: ApertureElementFrameSchema | None = None
    left: ApertureElementFrameSchema | None = None

    class Config:
        orm_mode = True
