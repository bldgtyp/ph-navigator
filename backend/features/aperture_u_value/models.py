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
    "incomplete_frame_data",
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


class ApertureEdgeBreakdown(BaseModel):
    """One exterior-view frame edge and its ISO 10077-1 heat-loss terms.

    Derived values stay null when the assigned product data or glazing
    geometry is incomplete. That preserves the available inputs without
    making missing data look like a real zero.
    """

    model_config = ConfigDict(extra="forbid")

    side: Literal["top", "right", "bottom", "left"]
    frame_id: str | None
    width_m: float | None
    u_value_w_m2k: float | None
    psi_g_w_mk: float | None
    psi_install_w_mk: float | None
    edge_length_m: float
    interior_length_m: float | None
    center_strip_area_m2: float | None
    corner_area_a_m2: float | None
    corner_area_b_m2: float | None
    frame_area_m2: float | None
    q_frame_w_k: float | None
    q_spacer_w_k: float | None


class ApertureElementDetail(BaseModel):
    """Per-element result plus every input and intermediate report term."""

    model_config = ConfigDict(extra="forbid")

    element_id: str
    glazing_id: str | None
    glazing_u_w_m2k: float | None
    glazing_g_value: float | None
    width_m: float
    height_m: float
    interior_width_m: float | None
    interior_height_m: float | None
    u_value_w_m2k: float
    area_m2: float
    glazing_area_m2: float
    frame_area_m2: float
    q_glazing_w_k: float | None
    q_frame_total_w_k: float | None
    q_spacer_total_w_k: float | None
    edges: list[ApertureEdgeBreakdown]
    warnings: list[ApertureUValueWarning]


class ApertureUValueResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    aperture_type_id: str
    window_u_value_w_m2k: float
    total_area_m2: float
    elements: list[ApertureElementUValue]
    warnings: list[ApertureUValueWarning]
    content_hash: str


class ApertureUValueDetailResult(BaseModel):
    """Uncached detailed calculation used by report and export surfaces."""

    model_config = ConfigDict(extra="forbid")

    aperture_type_id: str
    window_u_value_w_m2k: float
    total_area_m2: float
    elements: list[ApertureElementDetail]
    warnings: list[ApertureUValueWarning]
    content_hash: str


class AperturesUValueListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: Literal["draft", "version"]
    apertures: list[ApertureUValueResult]
