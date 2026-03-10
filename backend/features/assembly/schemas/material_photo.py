# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel, ConfigDict


class MaterialPhotoSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    segment_id: int
    full_size_url: str
    thumbnail_url: str
