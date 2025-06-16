# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel, Field, validator

# ---------------------------------------------------------------------------------------
# -- Table


class AirTableTableSchema(BaseModel):
    id: int
    name: str
    at_ref: str
    parent_base_id: str

    class Config:
        from_attributes = True
        orm_mode = True


# ---------------------------------------------------------------------------------------
# -- Base


class AirTableBaseSchema(BaseModel):
    id: str
    tables: list[AirTableTableSchema] = []

    class Config:
        from_attributes = True
        orm_mode = True


class AddAirTableBaseRequest(BaseModel):
    airtable_base_api_key: str = Field(..., min_length=20)
    airtable_base_ref: str = Field(..., min_length=8, max_length=50)
    bt_number: str = Field(..., pattern=r"^[a-zA-Z0-9\-]+$")

    @validator("airtable_base_api_key")
    def validate_api_key(cls, v: str):
        if not v.startswith("pat"):
            raise ValueError("Invalid AirTable API key format")
        return v

    def __repr__(self) -> str:
        return f"AddAirTableBaseRequest(bt_number={self.bt_number}, airtable_base_api_key=*****, airtable_base_ref={self.airtable_base_ref})"

    def __str__(self) -> str:
        return repr(self)
