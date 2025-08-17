# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pyairtable.api.types import RecordDict
from pydantic import BaseModel


class GlazingTypeDatasheetSchema(BaseModel):
    """Schema for Aperture Element Glazing-Type Datasheet."""

    id: str
    url: str
    filename: str
    size: int
    type: str


class GlazingTypeSchema(BaseModel):
    """Base schema for Glazing Type."""

    id: str
    name: str = "Unnamed Glazing"
    u_value_w_m2k: float
    g_value: float
    manufacturer: str | None = None
    brand: str | None = None
    source: str | None = None
    datasheet_url: str | None = None
    link: str | None = None
    comments: str | None = None

    class Config:
        orm_mode = True

    @classmethod
    def fromAirTableRecordDict(cls, record: RecordDict) -> GlazingTypeSchema:
        """Create a GlazingType instance from an AirTable RecordDict with 'fields' and 'id'."""
        d = {}
        d = d | record["fields"]

        # Add the ID to the fields
        d["id"] = record["id"]  
        
        # Pull out the Datasheet URL
        datasheets = [GlazingTypeDatasheetSchema(**ds) for ds in record['fields'].get("DATASHEET", [])]
        d["datasheet_url"] = datasheets[0].url if datasheets else None

        return cls(**{k.lower(): v for k, v in d.items()})  # Create an instance of the schema