# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from features.aperture.schemas.frame_type import FrameTypeSchema
from pyairtable.api.types import RecordDict
from pydantic import BaseModel, ConfigDict


class ApertureElementFrameSchema(BaseModel):
    """Base schema for Aperture Element Frame."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str = "Unnamed Frame"
    frame_type: FrameTypeSchema | None = None

    @classmethod
    def fromAirTableRecordDict(cls, record: RecordDict) -> ApertureElementFrameSchema:
        """Create an ApertureElementFrameSchema instance from an AirTable RecordDict with 'fields' and 'id'."""
        d = {}
        d = d | record["fields"]
        d["id"] = record["id"]  # Add the ID to the fields
        return cls(
            **{k.lower(): v for k, v in d.items()}
        )  # Create an instance of the schema


class ApertureElementFramesSchema(BaseModel):
    """Base schema for Aperture Element Frames Collection."""

    model_config = ConfigDict(from_attributes=True)

    top: ApertureElementFrameSchema
    right: ApertureElementFrameSchema
    bottom: ApertureElementFrameSchema
    left: ApertureElementFrameSchema
