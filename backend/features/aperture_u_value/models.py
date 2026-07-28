"""Public response shapes for the aperture U-Value service.

The service returns a structured result with the window-level value,
non-void per-element values, and warnings for incomplete assignments,
all-void types, and mullion frames beside voids. ``content_hash`` is
the SHA-256 over the result-affecting subtree (operation + name
explicitly excluded) so the frontend can detect identity-of-result
during refetch.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

UValueWarningKind = Literal[
    "missing_frame",
    "missing_glazing",
    "missing_dimension",
    "non_positive_glazing_area",
    "no_glazed_elements",
    "mullion_frame_at_void_boundary",
]


class ApertureUValueWarning(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: UValueWarningKind
    element_id: str | None = None
    side: Literal["top", "right", "bottom", "left"] | None = None
    axis: Literal["row", "column"] | None = None
    message: str


class ApertureElementUValue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    element_id: str
    u_value_w_m2k: float
    area_m2: float
    glazing_area_m2: float
    frame_area_m2: float
    warnings: list[ApertureUValueWarning]


class ApertureUValueResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    aperture_type_id: str
    window_u_value_w_m2k: float
    total_area_m2: float
    elements: list[ApertureElementUValue]
    warnings: list[ApertureUValueWarning]
    content_hash: str


class AperturesUValueListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: Literal["draft", "version"]
    apertures: list[ApertureUValueResult]
