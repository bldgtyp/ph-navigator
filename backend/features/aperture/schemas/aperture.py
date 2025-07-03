# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel

from features.aperture.schemas.aperture_element import ApertureElementSchema


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


class MergeApertureElementsRequest(BaseModel):
    aperture_element_ids: list[int]
