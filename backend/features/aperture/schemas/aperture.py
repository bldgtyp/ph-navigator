# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from enum import Enum

from pydantic import BaseModel

from features.aperture.schemas.aperture_element import ApertureElementSchema
from features.aperture.schemas.frame import ApertureElementFrameSchema


class ApertureSchema(BaseModel):
    """Base schema for Aperture."""

    id: int
    name: str
    row_heights_mm: list[float]
    column_widths_mm: list[float]
    elements: list[ApertureElementSchema]

    class Config:
        orm_mode = True


class ColumnDeleteRequest(BaseModel):
    column_number: int


class RowDeleteRequest(BaseModel):
    row_number: int


class UpdateNameRequest(BaseModel):
    new_name: str


class UpdateColumnWidthRequest(BaseModel):
    column_index: int
    new_width_mm: float


class UpdateRowHeightRequest(BaseModel):
    row_index: int
    new_height_mm: float


class FrameSide(str, Enum):
    TOP = "top"
    RIGHT = "right"
    BOTTOM = "bottom"
    LEFT = "left"


class UpdateApertureFrameRequest(BaseModel):
    element_id: int
    side: FrameSide
    frame_id: str


class MergeApertureElementsRequest(BaseModel):
    aperture_element_ids: list[int]


class SplitApertureElementRequest(BaseModel):
    aperture_element_id: int


class UpdateApertureElementNameRequest(BaseModel):
    aperture_element_name: str

