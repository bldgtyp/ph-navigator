# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel

# ---------------------------------------------------------------------------------------
# -- Table


class AirTableTableSchema(BaseModel):
    id: int
    name: str
    at_ref: str
    parent_base_id: int

    class Config:
        from_attributes = True
        from_orm = True


# ---------------------------------------------------------------------------------------
# -- Base


class AirTableBaseSchema(BaseModel):
    id: str
    tables: list[AirTableTableSchema] = []

    class Config:
        from_attributes = True
        orm_mode = True


class AddAirTableBaseRequest(BaseModel):
    airtable_base_api_key: str
    airtable_base_ref: str
    bt_number: str

    def __repr__(self) -> str:
        return f"AddAirTableBaseRequest(bt_number={self.bt_number}, airtable_base_api_key={self.airtable_base_api_key[0:5]}****, airtable_base_ref={self.airtable_base_ref})"

    def __str__(self) -> str:
        return repr(self)
