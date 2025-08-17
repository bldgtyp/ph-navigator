# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pyairtable.api.types import RecordDict
from pydantic import BaseModel


class FrameTypeDatasheetSchema(BaseModel):
    """Schema for Aperture Element Frame Type Datasheet."""

    id: str
    url: str
    filename: str
    size: int
    type: str


class FrameTypeSchema(BaseModel):
    """Base schema for Aperture Element Frame Type."""

    id: str
    name: str = "Unnamed Frame Type"
    width_mm: float
    u_value_w_m2k: float
    psi_g_w_mk: float
    manufacturer: str | None = None
    brand: str | None = None
    use: str | None = None
    operation: str | None = None
    location: str | None = None
    mull_type: str | None = None
    source: str | None = None
    datasheet_url: str | None = None
    link: str | None = None
    comments: str | None = None

    class Config:
        orm_mode = True

    @classmethod
    def fromAirTableRecordDict(cls, record: RecordDict) -> FrameTypeSchema:
        """Create an FrameType instance from an AirTable RecordDict with 'fields' and 'id'."""
        d = {}
        d = d | record["fields"]

        # Add the ID to the fields
        d["id"] = record["id"]  
        
        # Pull out the Datasheet URL
        datasheets = [FrameTypeDatasheetSchema(**ds) for ds in record['fields'].get("DATASHEET", [])]
        d["datasheet_url"] = datasheets[0].url if datasheets else None

        # Return an instance of the schema
        return cls(**{k.lower(): v for k, v in d.items()})  
        
