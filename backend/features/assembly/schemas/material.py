# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pyairtable.api.types import RecordDict
from pydantic import BaseModel, root_validator


class AirTableMaterialSchema(BaseModel):
    """Schema for Material records when they come in directly from AirTable."""

    id: str
    name: str = ""
    category: str = ""
    argb_color: str = ""
    conductivity_w_mk: float = 0.0
    emissivity: float = 0.0
    density_kg_m3: float = 0.0
    specific_heat_j_kgk: float = 100.0

    @root_validator(pre=True)
    def lowercase_keys(cls, values):
        # Convert all keys to lowercase
        return {k.lower(): v for k, v in values.items()}

    class Config:
        from_attributes = True
        orm_mode = True

    @classmethod
    def fromAirTableRecordDict(cls, record: RecordDict) -> AirTableMaterialSchema:
        """Create an AirTableMaterialSchema instance from an AirTable RecordDict with 'fields' and 'id'."""
        d = {}
        d = d | record["fields"]
        d["id"] = record["id"]  # Add the ID to the fields
        return cls(**d)  # Create an instance of the schema


class MaterialSchema(BaseModel):
    """Schema for Material records in the database."""

    id: str
    name: str = ""
    category: str = ""
    argb_color: str = ""
    conductivity_w_mk: float = 0.0
    emissivity: float = 0.0
    density_kg_m3: float = 0.0
    specific_heat_j_kgk: float = 100.0

    class Config:
        orm_mode = True
