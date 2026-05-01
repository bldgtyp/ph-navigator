# -*- Python Version: 3.11 -*-

from __future__ import annotations  # Enables forward references

from enum import Enum
from typing import TYPE_CHECKING

from features.aperture.schemas.aperture_element import ApertureElementSchema
from pydantic import BaseModel, ConfigDict, PrivateAttr, computed_field

if TYPE_CHECKING:
    from db_entities.aperture.aperture import Aperture


class ApertureSchema(BaseModel):
    """Base schema for Aperture.

    Exposes a per-aperture ``last_modified`` aggregate (UTC ISO-8601
    with trailing ``Z``) computed by walking the parent aperture, its
    elements, and the referenced glazing-type / frame-type catalog
    rows. The Rhino plugin compares this value byte-for-byte against
    a stored copy on each block, so the format is part of the wire
    contract — see ``services/last_modified.py``.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    row_heights_mm: list[float]
    column_widths_mm: list[float]
    elements: list[ApertureElementSchema]

    # The ``last_modified`` aggregate walks relationships not exposed
    # as schema fields (``element.glazing.glazing_type``, each
    # ``frame.frame_type``), so we hold onto the source ORM instance.
    _orm_aperture: "Aperture | None" = PrivateAttr(default=None)

    @classmethod
    def model_validate(cls, obj, /, **kwargs):
        instance = super().model_validate(obj, **kwargs)
        instance._orm_aperture = obj
        return instance

    @computed_field  # type: ignore[prop-decorator]
    @property
    def last_modified(self) -> str:
        # Deferred import: services/last_modified.py imports the
        # FrameSide enum from this module, so a top-level import here
        # would cycle.
        from features.aperture.services.last_modified import (
            compute_aperture_effective_last_modified,
            format_last_modified,
        )

        if self._orm_aperture is None:
            raise ValueError(
                "ApertureSchema.last_modified requires construction via "
                "model_validate(orm_instance); got a schema with no source "
                "ORM reference."
            )
        return format_last_modified(
            compute_aperture_effective_last_modified(self._orm_aperture)
        )


class ColumnDeleteRequest(BaseModel):
    column_number: int


class RowDeleteRequest(BaseModel):
    row_number: int


class UpdateNameRequest(BaseModel):
    new_name: str


class UpdateGlazingRequest(BaseModel):
    glazing_id: str


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


class InsertPosition(str, Enum):
    """Position for inserting new rows/columns."""

    START = "start"  # Index 0 - top for rows, left for columns
    END = "end"  # Append - bottom for rows, right for columns


class AddRowRequest(BaseModel):
    """Request body for adding a row."""

    position: InsertPosition = InsertPosition.END


class AddColumnRequest(BaseModel):
    """Request body for adding a column."""

    position: InsertPosition = InsertPosition.END


class UpdateApertureFrameRequest(BaseModel):
    element_id: int
    side: FrameSide
    frame_type_id: str


class MergeApertureElementsRequest(BaseModel):
    aperture_element_ids: list[int]


class SplitApertureElementRequest(BaseModel):
    aperture_element_id: int


class UpdateApertureElementNameRequest(BaseModel):
    aperture_element_name: str
