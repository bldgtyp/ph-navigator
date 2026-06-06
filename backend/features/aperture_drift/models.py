"""Drift report wire shapes.

The frontend renders one entry per drifted (element, target) pair —
each of the four frame sides + the glazing is reported separately so
the per-card refresh button can scope the dialog to that single ref.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

DriftKind = Literal["field_delta", "catalog_row_missing"]


# Which catalog-aware slot on an element drifted. ``frame.<side>`` matches
# the ``editFieldOverride`` target shape so callers can route between
# drift / override surfaces without re-mapping.
DriftTarget = Literal[
    "frame.top",
    "frame.right",
    "frame.bottom",
    "frame.left",
    "glazing",
]


class RefFieldDelta(BaseModel):
    """One differing field between a project ref and its catalog row."""

    model_config = ConfigDict(extra="forbid")

    field_key: str
    catalog_value: object | None
    yours_value: object | None
    in_local_overrides: bool


class ApertureDriftEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    aperture_type_id: str
    aperture_type_name: str
    element_id: str
    element_name: str
    target: DriftTarget
    kind: DriftKind
    catalog_record_id: str
    deltas: list[RefFieldDelta]


class ApertureDriftReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entries: list[ApertureDriftEntry]
