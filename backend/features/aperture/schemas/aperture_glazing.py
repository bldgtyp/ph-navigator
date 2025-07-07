# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel


class ApertureElementGlazingSchema(BaseModel):
    """Base schema for Aperture Element Glazing."""

    id: int
    name: str = "Unnamed Glazing"
    u_value_w_m2k: float
    g_value: float

    class Config:
        orm_mode = True
