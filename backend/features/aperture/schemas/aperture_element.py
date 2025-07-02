# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from pydantic import BaseModel


class ApertureElementSchema(BaseModel):
    """Base schema for Aperture Element."""

    id: int
    row_number: int
    column_number: int
    row_span: int = 1
    col_span: int = 1

    class Config:
        orm_mode = True
