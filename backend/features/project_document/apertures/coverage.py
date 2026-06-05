"""Aperture-grid coverage invariant: every cell covered by exactly one element.

The Aperture Builder's grid is a `R x C` rectangle of cells defined by
`row_heights_mm` and `column_widths_mm`. Each `ApertureElement` occupies
a contiguous sub-rectangle via inclusive `row_span` / `column_span`.

Two cell-level errors are surfaced:

- ``aperture_coverage_overlap`` — two elements claim the same cell.
- ``aperture_coverage_hole`` — a cell is unclaimed.

Out-of-bounds spans raise ``aperture_element_span_out_of_bounds`` so the
caller can distinguish "you sized the grid too small" from a coverage
arithmetic bug. The check is pure — it does not touch the catalog or any
other slice — so later phases (merge/split, add-row/add-column command
handlers) reuse it as a pre-write guard.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from features.project_document.document import ApertureTypeEntry


class CoverageError(ValueError):
    """Structured failure raised by `check_aperture_coverage`.

    Carries a stable `code` so route-layer error translators can map it
    to the structured API envelope without parsing the message string.
    """

    def __init__(self, code: str, message: str, **detail: object) -> None:
        super().__init__(message)
        self.code = code
        self.detail: dict[str, object] = detail


def check_aperture_coverage(entry: ApertureTypeEntry) -> None:
    rows = len(entry.row_heights_mm)
    cols = len(entry.column_widths_mm)

    element_ids: set[str] = set()
    cover: dict[tuple[int, int], str] = {}

    for element in entry.elements:
        if element.id in element_ids:
            raise CoverageError(
                "aperture_duplicate_element_id",
                f"Duplicate aperture element id: {element.id}",
                element_id=element.id,
            )
        element_ids.add(element.id)

        r0, r1 = element.row_span
        c0, c1 = element.column_span
        if not (0 <= r0 <= r1 < rows):
            raise CoverageError(
                "aperture_element_span_out_of_bounds",
                f"Aperture element {element.id} row_span out of bounds",
                element_id=element.id,
                axis="row",
                span=[r0, r1],
                rows=rows,
            )
        if not (0 <= c0 <= c1 < cols):
            raise CoverageError(
                "aperture_element_span_out_of_bounds",
                f"Aperture element {element.id} column_span out of bounds",
                element_id=element.id,
                axis="column",
                span=[c0, c1],
                cols=cols,
            )
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                prior = cover.get((r, c))
                if prior is not None:
                    raise CoverageError(
                        "aperture_coverage_overlap",
                        f"Aperture cell ({r}, {c}) is covered by both {prior} and {element.id}",
                        cell=[r, c],
                        first_element_id=prior,
                        second_element_id=element.id,
                    )
                cover[(r, c)] = element.id

    for r in range(rows):
        for c in range(cols):
            if (r, c) not in cover:
                raise CoverageError(
                    "aperture_coverage_hole",
                    f"Aperture cell ({r}, {c}) is not covered by any element",
                    cell=[r, c],
                )
