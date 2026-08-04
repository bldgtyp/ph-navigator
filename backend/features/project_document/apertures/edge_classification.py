"""Perimeter-vs-interior classification of aperture-element edges.

An element side is **interior** (a mull joint, derived Psi-install = 0 —
aperture-psi-install D-3, Phius §1.4.4.6 "0 at mulled sides") iff every
grid cell across that side belongs to another element of kind ``glazed``.
Sides on the aperture boundary are perimeter, and cells belonging to
``void`` elements count as perimeter too: a void panel is an opening in
the sash layout, so its boundary is still an install edge. A side that
abuts a mix of glazed and void neighbours is perimeter — only a fully
mulled side carries no install edge.

Pure geometry: no catalog or slot lookups, so the phase-02 resolver and
grid-mutation hygiene can call it as a plain function.

Mirrored in TypeScript for zero-latency display:
``frontend/src/features/apertures/edge-classification.ts`` — keep the two
in lockstep (their test suites copy the same case tables).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from features.project_document.aperture_commands.models import APERTURE_SIDES, ApertureSide

if TYPE_CHECKING:
    from features.project_document.document import ApertureTypeEntry

EdgeClass = Literal["perimeter", "interior"]


def classify_element_edges(aperture: ApertureTypeEntry) -> dict[tuple[str, ApertureSide], EdgeClass]:
    """Classify every side of every element as ``perimeter`` or ``interior``.

    Void elements are classified too (all their sides are perimeter) so
    callers can index the result without special-casing element kind.
    """
    rows = len(aperture.row_heights_mm)
    cols = len(aperture.column_widths_mm)

    glazed_cells: set[tuple[int, int]] = set()
    for element in aperture.elements:
        if element.kind != "glazed":
            continue
        for row in range(element.row_span[0], element.row_span[1] + 1):
            for column in range(element.column_span[0], element.column_span[1] + 1):
                glazed_cells.add((row, column))

    classes: dict[tuple[str, ApertureSide], EdgeClass] = {}
    for element in aperture.elements:
        if element.kind != "glazed":
            # A void panel carries no install assignments; every side is a
            # perimeter (opening-boundary) edge for classification purposes.
            for side in APERTURE_SIDES:
                classes[(element.id, side)] = "perimeter"
            continue
        row_start, row_end = element.row_span
        column_start, column_end = element.column_span
        columns = range(column_start, column_end + 1)
        row_range = range(row_start, row_end + 1)
        neighbour_cells: dict[ApertureSide, list[tuple[int, int]]] = {
            "top": [(row_start - 1, column) for column in columns] if row_start > 0 else [],
            "bottom": [(row_end + 1, column) for column in columns] if row_end + 1 < rows else [],
            "left": [(row, column_start - 1) for row in row_range] if column_start > 0 else [],
            "right": [(row, column_end + 1) for row in row_range] if column_end + 1 < cols else [],
        }
        for side, cells in neighbour_cells.items():
            is_interior = bool(cells) and all(cell in glazed_cells for cell in cells)
            classes[(element.id, side)] = "interior" if is_interior else "perimeter"
    return classes
