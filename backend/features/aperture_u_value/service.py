"""ISO 10077-1:2006 composite U-Value calculation, ported from V1.

For each ``ApertureElement``:

    Q_g  = A_g × U_g                            (glazing heat loss)
    Q_f  = Σ (A_f,side × U_f,side)              (frame heat loss, with 45°
                                                  corner split)
    Q_ψ  = Σ (l_g,side × Ψ_g,side)              (spacer / edge heat loss)
    U_el = (Q_g + Q_f + Q_ψ) / A_total

The window-level U-Value is the area-weighted average of the per-
element values (same formula at aggregate). Operation is excluded —
PRD §14 + V1 keep operation orthogonal to U_w.

Void elements are excluded from the area, heat flow, and per-element
results. Missing assignments, all-void types, and mullion frames beside
voids are reported via ``ApertureUValueWarning`` rather than raising.

Cache: results are keyed by ``content_hash_for_aperture(entry)`` so
operation / name changes hit the cache instantly while kind, geometry,
thermal assignments, and warning-affecting mull types invalidate it.
"""

from __future__ import annotations

from dataclasses import dataclass

from features.aperture_u_value.cache import cache_get, cache_put, content_hash_for_aperture
from features.aperture_u_value.models import (
    ApertureElementUValue,
    ApertureUValueResult,
    ApertureUValueWarning,
)
from features.project_document.aperture_commands.models import (
    APERTURE_SIDES,
    ApertureSide,
)
from features.project_document.apertures.lookup import frame_by_id, glazing_by_id
from features.project_document.document import (
    ApertureElement,
    ApertureTypeEntry,
    ProjectDocumentTables,
    ProjectFrame,
    ProjectGlazing,
)


@dataclass(frozen=True)
class _FrameData:
    width_m: float
    u_value_w_m2k: float
    psi_g_w_mk: float


def calculate_aperture_u_values(entry: ApertureTypeEntry, tables: ProjectDocumentTables) -> ApertureUValueResult:
    cache_key = content_hash_for_aperture(entry, tables)
    cached = cache_get(cache_key)
    if isinstance(cached, ApertureUValueResult):
        return cached

    element_results: list[ApertureElementUValue] = []
    aggregate_warnings: list[ApertureUValueWarning] = []
    total_q = 0.0
    total_area = 0.0

    glazed_elements = [element for element in entry.elements if element.kind == "glazed"]
    if not glazed_elements:
        aggregate_warnings.append(
            ApertureUValueWarning(
                kind="no_glazed_elements",
                message=f"Aperture type {entry.id} contains no glazed elements.",
            )
        )

    void_adjacency = _void_adjacency_by_element(entry, glazed_elements)
    for element in glazed_elements:
        per_el = _calculate_element(
            entry,
            element,
            tables,
            void_adjacent_sides=void_adjacency.get(element.id, ()),
        )
        element_results.append(per_el)
        aggregate_warnings.extend(per_el.warnings)
        total_q += per_el.u_value_w_m2k * per_el.area_m2
        total_area += per_el.area_m2

    window_u = round(total_q / total_area, 4) if total_area > 0 else 0.0

    result = ApertureUValueResult(
        aperture_type_id=entry.id,
        window_u_value_w_m2k=window_u,
        total_area_m2=round(total_area, 6),
        elements=element_results,
        warnings=aggregate_warnings,
        content_hash=cache_key,
    )
    cache_put(cache_key, result)
    return result


def _void_adjacency_by_element(
    entry: ApertureTypeEntry,
    glazed_elements: list[ApertureElement],
) -> dict[str, tuple[ApertureSide, ...]]:
    """Index Empty cells once, then inspect only each glazed perimeter."""
    if not glazed_elements:
        return {}
    void_cells: set[tuple[int, int]] = set()
    for element in entry.elements:
        if element.kind != "void":
            continue
        for row in range(element.row_span[0], element.row_span[1] + 1):
            for column in range(element.column_span[0], element.column_span[1] + 1):
                void_cells.add((row, column))
    if not void_cells:
        return {}

    adjacency: dict[str, tuple[ApertureSide, ...]] = {}
    for element in glazed_elements:
        row_start, row_end = element.row_span
        column_start, column_end = element.column_span
        sides: list[ApertureSide] = []
        if row_start > 0 and any(
            (row_start - 1, column) in void_cells for column in range(column_start, column_end + 1)
        ):
            sides.append("top")
        if column_end + 1 < len(entry.column_widths_mm) and any(
            (row, column_end + 1) in void_cells for row in range(row_start, row_end + 1)
        ):
            sides.append("right")
        if row_end + 1 < len(entry.row_heights_mm) and any(
            (row_end + 1, column) in void_cells for column in range(column_start, column_end + 1)
        ):
            sides.append("bottom")
        if column_start > 0 and any((row, column_start - 1) in void_cells for row in range(row_start, row_end + 1)):
            sides.append("left")
        if sides:
            adjacency[element.id] = tuple(sides)
    return adjacency


def _calculate_element(
    entry: ApertureTypeEntry,
    element: ApertureElement,
    tables: ProjectDocumentTables,
    *,
    void_adjacent_sides: tuple[ApertureSide, ...] = (),
) -> ApertureElementUValue:
    width_m = _element_width_m(entry, element)
    height_m = _element_height_m(entry, element)
    total_area = width_m * height_m

    frame_refs: dict[ApertureSide, ProjectFrame | None] = {
        side: frame_by_id(tables, getattr(element.frames, side)) for side in APERTURE_SIDES
    }
    frames = {side: _frame_data(frame_refs[side]) for side in APERTURE_SIDES}
    warnings: list[ApertureUValueWarning] = []
    for side in APERTURE_SIDES:
        if frames[side] is None:
            warnings.append(
                ApertureUValueWarning(
                    kind="missing_frame",
                    element_id=element.id,
                    side=side,
                    message=f"Element {element.id} is missing a {side} frame assignment.",
                )
            )
    for side in void_adjacent_sides:
        frame = frame_refs[side]
        if frame is None or not frame.mull_type:
            continue
        warnings.append(
            ApertureUValueWarning(
                kind="mullion_frame_at_void_boundary",
                element_id=element.id,
                side=side,
                message=(
                    f"Element {element.id} has a mullion frame on its {side} edge next to an Empty panel; "
                    "re-check the jamb, sill, or head frame assignment."
                ),
            )
        )

    glazing_u = _glazing_u_value(glazing_by_id(tables, element.glazing_id))
    if glazing_u is None:
        warnings.append(
            ApertureUValueWarning(
                kind="missing_glazing",
                element_id=element.id,
                message=f"Element {element.id} is missing a glazing assignment.",
            )
        )

    # If any assignment is missing the value falls back to zero — the
    # warning list carries the why; consumers render "(unfinished)".
    if any(frames[side] is None for side in ("top", "right", "bottom", "left")) or glazing_u is None:
        return ApertureElementUValue(
            element_id=element.id,
            u_value_w_m2k=0.0,
            area_m2=round(total_area, 6),
            glazing_area_m2=0.0,
            frame_area_m2=0.0,
            warnings=warnings,
        )

    f_top = frames["top"]
    f_right = frames["right"]
    f_bottom = frames["bottom"]
    f_left = frames["left"]
    assert f_top and f_right and f_bottom and f_left  # noqa: S101 — narrowed above

    interior_width = width_m - f_left.width_m - f_right.width_m
    interior_height = height_m - f_top.width_m - f_bottom.width_m
    if interior_width <= 0 or interior_height <= 0:
        warnings.append(
            ApertureUValueWarning(
                kind="non_positive_glazing_area",
                element_id=element.id,
                message=(
                    f"Element {element.id} frame widths exceed the element rectangle; glazing area is non-positive."
                ),
            )
        )
        return ApertureElementUValue(
            element_id=element.id,
            u_value_w_m2k=0.0,
            area_m2=round(total_area, 6),
            glazing_area_m2=0.0,
            frame_area_m2=round(total_area, 6),
            warnings=warnings,
        )

    glazing_area = interior_width * interior_height
    frame_area = total_area - glazing_area

    q_glazing = glazing_area * glazing_u
    q_frame = (
        _side_frame_q(f_top, f_left, f_right, interior_width)
        + _side_frame_q(f_right, f_top, f_bottom, interior_height)
        + _side_frame_q(f_bottom, f_left, f_right, interior_width)
        + _side_frame_q(f_left, f_top, f_bottom, interior_height)
    )
    q_spacer = (
        f_top.psi_g_w_mk * interior_width
        + f_right.psi_g_w_mk * interior_height
        + f_bottom.psi_g_w_mk * interior_width
        + f_left.psi_g_w_mk * interior_height
    )

    element_u = (q_glazing + q_frame + q_spacer) / total_area if total_area > 0 else 0.0
    return ApertureElementUValue(
        element_id=element.id,
        u_value_w_m2k=round(element_u, 4),
        area_m2=round(total_area, 6),
        glazing_area_m2=round(glazing_area, 6),
        frame_area_m2=round(frame_area, 6),
        warnings=warnings,
    )


def _side_frame_q(
    frame: _FrameData,
    adj_a: _FrameData,
    adj_b: _FrameData,
    interior_length: float,
) -> float:
    """45° corner split — each side carries half of each of its two corner
    rectangles plus a center strip the length of the glazing edge."""

    center = frame.width_m * interior_length
    corner_a = (frame.width_m * adj_a.width_m) / 2.0
    corner_b = (frame.width_m * adj_b.width_m) / 2.0
    return (center + corner_a + corner_b) * frame.u_value_w_m2k


def _element_width_m(entry: ApertureTypeEntry, element: ApertureElement) -> float:
    cs, ce = element.column_span
    return sum(entry.column_widths_mm[cs : ce + 1]) / 1000.0


def _element_height_m(entry: ApertureTypeEntry, element: ApertureElement) -> float:
    rs, re = element.row_span
    return sum(entry.row_heights_mm[rs : re + 1]) / 1000.0


def _frame_data(frame: ProjectFrame | None) -> _FrameData | None:
    if frame is None:
        return None
    if frame.width_mm is None or frame.u_value_w_m2k is None or frame.psi_g_w_mk is None:
        return None
    return _FrameData(
        width_m=frame.width_mm / 1000.0,
        u_value_w_m2k=frame.u_value_w_m2k,
        psi_g_w_mk=frame.psi_g_w_mk,
    )


def _glazing_u_value(glazing: ProjectGlazing | None) -> float | None:
    if glazing is None or glazing.u_value_w_m2k is None:
        return None
    return glazing.u_value_w_m2k
