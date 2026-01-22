# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: Model metadata for listing available HBJSON models."""

from datetime import date

from pydantic import BaseModel


class HBModelMetadataSchema(BaseModel):
    """Metadata for an HBJSON model record in AirTable."""

    record_id: str
    date: date

    class Config:
        orm_mode = True
