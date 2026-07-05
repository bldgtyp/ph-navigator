"""Denormalized aperture-type grid JSON for the Grasshopper Data API.

V1's `get-apertures-as-json` parity: each aperture type → grid dims (mm) →
elements, with the referenced glazing and per-side frames inlined so the GH
`WindowUnitType` builder needs no follow-up lookups.

Span shape: V2 stores inclusive `(start, end)` tuples; the GH client wants V1's
`row_number` / `column_number` + `row_span` / `col_span` **counts**. Row order is
already top-to-bottom in V2 (row 0 = top), matching V1's wire convention, so no
server-side reversal is needed (the GH client does its own bottom-to-top flip
for Rhino). `chi_value` is omitted — V2 frames have no chi field (O3); the client
defaults it to 0.0. `psi_install_w_mk` IS emitted (V1 never sent it and the
client silently defaulted 0.04).
"""

from __future__ import annotations

from typing import Any

from features.gh_api.export_helpers import reject_duplicate_names
from features.project_document.apertures.lookup import frame_by_id, glazing_by_id
from features.project_document.document import ProjectDocumentTables, ProjectDocumentV1
from features.project_document.envelope_models import (
    ApertureElement,
    ApertureOperation,
    ApertureTypeEntry,
    ProjectFrame,
    ProjectGlazing,
)

__all__ = ["export_aperture_types"]

_FRAME_SIDES = ("top", "right", "bottom", "left")


def export_aperture_types(body: ProjectDocumentV1) -> dict[str, dict[str, Any]]:
    """Serialize every aperture type as denormalized grid JSON, keyed by type name."""
    reject_duplicate_names(
        (aperture.name for aperture in body.tables.apertures),
        error_code="duplicate_aperture_type_names",
        message="Aperture types have duplicate names; rename them so each is unique before exporting to Grasshopper.",
    )
    return {aperture.name: _aperture_type(aperture, body.tables) for aperture in body.tables.apertures}


def _aperture_type(aperture: ApertureTypeEntry, tables: ProjectDocumentTables) -> dict[str, Any]:
    return {
        "name": aperture.name,
        "display_name": aperture.name,
        "row_heights_mm": list(aperture.row_heights_mm),
        "column_widths_mm": list(aperture.column_widths_mm),
        "elements": [_element(element, tables) for element in aperture.elements],
    }


def _element(element: ApertureElement, tables: ProjectDocumentTables) -> dict[str, Any]:
    row_start, row_end = element.row_span
    column_start, column_end = element.column_span
    return {
        "name": element.name,
        "row_number": row_start,
        "column_number": column_start,
        "row_span": row_end - row_start + 1,
        "col_span": column_end - column_start + 1,
        "glazing": _glazing(glazing_by_id(tables, element.glazing_id)),
        "frames": {side: _frame(frame_by_id(tables, getattr(element.frames, side))) for side in _FRAME_SIDES},
        "operation": _operation(element.operation),
    }


def _glazing(glazing: ProjectGlazing | None) -> dict[str, Any] | None:
    if glazing is None:
        return None
    return {
        "name": glazing.name,
        "glazing_type": {
            "id": glazing.id,
            "name": glazing.name,
            "u_value_w_m2k": glazing.u_value_w_m2k,
            "g_value": glazing.g_value,
            "specification_status": glazing.specification_status,
            "manufacturer": glazing.manufacturer,
            "brand": glazing.brand,
        },
    }


def _frame(frame: ProjectFrame | None) -> dict[str, Any] | None:
    if frame is None:
        return None
    return {
        "name": frame.name,
        "frame_type": {
            "id": frame.id,
            "name": frame.name,
            "width_mm": frame.width_mm,
            "u_value_w_m2k": frame.u_value_w_m2k,
            "psi_g_w_mk": frame.psi_g_w_mk,
            "psi_install_w_mk": frame.psi_install_w_mk,
            "specification_status": frame.specification_status,
            "manufacturer": frame.manufacturer,
            "operation": frame.operation,
        },
    }


def _operation(operation: ApertureOperation | None) -> dict[str, Any] | None:
    if operation is None:
        return None
    return {"type": operation.type, "directions": list(operation.directions)}
