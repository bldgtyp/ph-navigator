# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pyairtable.api.types import RecordDict
from pydantic import BaseModel

from features.aperture.schemas.frame_type import FrameTypeSchema


class ApertureElementFrameSchema(BaseModel):
    """Base schema for Aperture Element Frame."""

    id: str
    name: str = "Unnamed Frame"
    frame_type: FrameTypeSchema | None = None

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

    top: ApertureElementFrameSchema
    right: ApertureElementFrameSchema
    bottom: ApertureElementFrameSchema
    left: ApertureElementFrameSchema

    class Config:
        orm_mode = True
