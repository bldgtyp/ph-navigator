# -*- Python Version: 3.11 (Render.com) -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel

from features.assembly.schemas.material_photo import MaterialPhotoSchema
from features.assembly.schemas.material_datasheet import MaterialDatasheetSchema


class SegmentSitePhotoUrlsResponse(BaseModel):
    photo_urls: list[MaterialPhotoSchema]


class SegmentDatasheetUrlResponse(BaseModel):
    datasheet_urls: list[MaterialDatasheetSchema]
