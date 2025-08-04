# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pyairtable.api.types import RecordDict
from pydantic import BaseModel


class FrameTypeSchema(BaseModel):
    """Base schema for Aperture Element Frame Type."""

    id: str
    name: str = "Unnamed Frame Type"
    width_mm: float
    u_value_w_m2k: float


    # TODO: add psi-glazing-edge

    class Config:
        orm_mode = True

    @classmethod
    def fromAirTableRecordDict(cls, record: RecordDict) -> FrameTypeSchema:
        """Create an FrameType instance from an AirTable RecordDict with 'fields' and 'id'."""
        d = {}
        d = d | record["fields"]
        d["id"] = record["id"]  # Add the ID to the fields
        return cls(**{k.lower(): v for k, v in d.items()})  # Create an instance of the schema
