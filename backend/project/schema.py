from __future__ import annotations  # Enables forward references

from pydantic import BaseModel

from air_table.schema import AirTableBaseCreateSchema

# ---------------------------------------------------------------------------------------


class ProjectBaseSchema(BaseModel):
    name: str
    bt_number: str
    phius_number: str | None = None


class ProjectCreateSchema(ProjectBaseSchema):
    airtable_base: AirTableBaseCreateSchema


class ProjectSchema(ProjectBaseSchema):
    id: int
    owner_id: int
    user_ids: list[int] = []
    airtable_base_ref: str
    airtable_base_url: str
    phius_dropbox_url: str

    class Config:
        from_attributes = True


ProjectSchema.model_rebuild() # Update the forward references in the model

