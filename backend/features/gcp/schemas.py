# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from typing import Dict, List

from pydantic import BaseModel

from features.assembly.schemas.material_datasheet import MaterialDatasheetSchema
from features.assembly.schemas.material_photo import MaterialPhotoSchema


class SegmentSitePhotoUrlsResponse(BaseModel):
    photo_urls: list[MaterialPhotoSchema]


class SegmentDatasheetUrlResponse(BaseModel):
    datasheet_urls: list[MaterialDatasheetSchema]


class ProjectMediaUrlsResponse(BaseModel):
    """Response schema for batch fetching all media URLs for a project.

    Contains all site photos and datasheets grouped by segment ID.
    """

    site_photos: Dict[int, List[MaterialPhotoSchema]]
    datasheets: Dict[int, List[MaterialDatasheetSchema]]
