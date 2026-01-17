# -*- Python Version: 3.11 -*-

from pydantic import BaseModel


class ManufacturerFilterResponseSchema(BaseModel):
    """Response schema for manufacturer filter configuration."""

    available_frame_manufacturers: list[str]
    enabled_frame_manufacturers: list[str]
    available_glazing_manufacturers: list[str]
    enabled_glazing_manufacturers: list[str]
    used_frame_manufacturers: list[str]
    used_glazing_manufacturers: list[str]


class ManufacturerFilterUpdateSchema(BaseModel):
    """Request schema for updating manufacturer filter configuration."""

    enabled_frame_manufacturers: list[str]
    enabled_glazing_manufacturers: list[str]
