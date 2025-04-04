# -*- Python Version: 3.11 (Render.com) -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel

# ---------------------------------------------------------------------------------------


class AirTableTableBaseSchema(BaseModel):
    name: str
    airtable_ref: str


class AirTableTableCreateSchema(AirTableTableBaseSchema):
    pass


class AirTableTableSchema(AirTableTableBaseSchema):
    id: int
    parent_base_id: int

    class Config:
        from_attributes = True
        from_orm = True


# ---------------------------------------------------------------------------------------


class AirTableBaseBaseSchema(BaseModel):
    name: str
    airtable_ref: str


class AirTableBaseCreateSchema(AirTableBaseBaseSchema):
    pass


class AirTableBaseSchema(AirTableBaseBaseSchema):
    id: int
    tables: list[AirTableTableSchema] = []

    class Config:
        from_attributes = True
        orm_mode = True
