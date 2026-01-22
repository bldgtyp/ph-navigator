# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel, Field


class ProjectCreateSchema(BaseModel):
    name: str = Field(..., description="The name of the project.")
    bt_number: str = Field(..., description="The BuildingType number of the project.")
    phius_number: str | None = Field(
        None, description="The PHIUS number of the project."
    )
    phius_dropbox_url: str | None = Field(
        None, description="The PHIUS Dropbox URL of the project."
    )


class ProjectSchema(BaseModel):
    id: int
    name: str
    bt_number: str
    phius_number: str | None = None
    phius_dropbox_url: str | None = None
    airtable_base_url: str | None = None

    # Foreign Keys
    owner_id: int
    airtable_base_id: str | None = None

    class Config:
        from_attributes = True
        orm_mode = True


class AirTableTableUpdateSchema(BaseModel):
    id: int
    name: str
    at_ref: str
    parent_base_id: str
