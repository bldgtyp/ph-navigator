# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pyairtable.api.types import RecordDict
from pydantic import BaseModel


class ApertureElementFrameSchema(BaseModel):
    """Base schema for Aperture Element Frame."""

    id: str
    name: str = "Unnamed Frame"
    width_mm: float
    u_value_w_m2k: float

    class Config:
        orm_mode = True

    @classmethod
    def fromAirTableRecordDict(cls, record: RecordDict) -> ApertureElementFrameSchema:
        """Create an ApertureElementFrameSchema instance from an AirTable RecordDict with 'fields' and 'id'."""
        d = {}
        d = d | record["fields"]
        d["id"] = record["id"]  # Add the ID to the fields
        return cls(**{k.lower(): v for k, v in d.items()})  # Create an instance of the schema


class ApertureElementFramesSchema(BaseModel):
    """Base schema for Aperture Element Frames Collection."""

    top: ApertureElementFrameSchema | None = None
    right: ApertureElementFrameSchema | None = None
    bottom: ApertureElementFrameSchema | None = None
    left: ApertureElementFrameSchema | None = None

    class Config:
        orm_mode = True
