"""ISO 10077-1:2006 composite aperture U-value calculation.

The detailed entry point retains every per-edge area, length, and heat-loss
term needed by audit reports. The legacy entry point projects that detail back
to the original response shape and cache contract, keeping the builder and
existing API behavior unchanged.

Void elements are excluded. Missing assignments, incomplete products,
all-void types, invalid glazing geometry, and mullion frames beside voids are
reported through typed warnings rather than raising.
"""

from __future__ import annotations

from dataclasses import dataclass

from features.aperture_u_value.cache import cache_get, cache_put, content_hash_for_aperture
from features.aperture_u_value.models import (
    ApertureEdgeBreakdown,
    ApertureElementDetail,
    ApertureElementUValue,
    ApertureUValueCalculation,
    ApertureUValueDetailResult,
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
    frame_id: str
    width_m: float
    u_value_w_m2k: float
    psi_g_w_mk: float
    psi_install_w_mk: float | None


def calculate_aperture_u_values(
    entry: ApertureTypeEntry,
    tables: ProjectDocumentTables,
) -> ApertureUValueResult:
    """Return the cached legacy response used by the builder."""
    cache_key = content_hash_for_aperture(entry, tables)
    cached = cache_get(cache_key)
    if isinstance(cached, ApertureUValueResult):
        return cached

    detailed = calculate_aperture_u_value_terms(entry, tables)
    result = ApertureUValueResult(
        aperture_type_id=detailed.aperture_type_id,
        window_u_value_w_m2k=detailed.window_u_value_w_m2k,
        total_area_m2=detailed.total_area_m2,
        elements=[_legacy_element(element) for element in detailed.elements],
        warnings=detailed.warnings,
        content_hash=cache_key,
    )
    cache_put(cache_key, result)
    return result


def calculate_aperture_u_values_detailed(
    entry: ApertureTypeEntry,
    tables: ProjectDocumentTables,
) -> ApertureUValueDetailResult:
    """Calculate fresh detail without using the name-blind legacy cache."""
    calculation = calculate_aperture_u_value_terms(entry, tables)
    return ApertureUValueDetailResult(
        **calculation.model_dump(),
        content_hash=content_hash_for_aperture(entry, tables),
    )


def calculate_aperture_u_value_terms(
    entry: ApertureTypeEntry,
    tables: ProjectDocumentTables,
) -> ApertureUValueCalculation:
    """Calculate report-ready terms without cache lookup or hash generation."""
    element_results: list[ApertureElementDetail] = []
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
        detail = _calculate_element_detail(
            entry,
            element,
            tables,
            void_adjacent_sides=void_adjacency.get(element.id, ()),
        )
        element_results.append(detail)
        aggregate_warnings.extend(detail.warnings)
        total_q += detail.u_value_w_m2k * detail.area_m2
        total_area += detail.area_m2

    return ApertureUValueCalculation(
        aperture_type_id=entry.id,
        window_u_value_w_m2k=round(total_q / total_area, 4) if total_area > 0 else 0.0,
        total_area_m2=round(total_area, 6),
        elements=element_results,
        warnings=aggregate_warnings,
    )


def _legacy_element(detail: ApertureElementDetail) -> ApertureElementUValue:
    return ApertureElementUValue(
        element_id=detail.element_id,
        u_value_w_m2k=detail.u_value_w_m2k,
        area_m2=detail.area_m2,
        glazing_area_m2=detail.glazing_area_m2,
        frame_area_m2=detail.frame_area_m2,
        warnings=detail.warnings,
    )


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


def _calculate_element_detail(
    entry: ApertureTypeEntry,
    element: ApertureElement,
    tables: ProjectDocumentTables,
    *,
    void_adjacent_sides: tuple[ApertureSide, ...] = (),
) -> ApertureElementDetail:
    width_m = _element_width_m(entry, element)
    height_m = _element_height_m(entry, element)
    total_area = width_m * height_m

    frame_ids: dict[ApertureSide, str | None] = {side: getattr(element.frames, side) for side in APERTURE_SIDES}
    frame_refs: dict[ApertureSide, ProjectFrame | None] = {
        side: frame_by_id(tables, frame_ids[side]) for side in APERTURE_SIDES
    }
    frames = {side: _frame_data(frame_ids[side], frame_refs[side]) for side in APERTURE_SIDES}
    warnings = _frame_warnings(element.id, frame_ids, frame_refs)
    warnings.extend(
        _void_boundary_warnings(
            element.id,
            frame_refs,
            void_adjacent_sides,
        )
    )

    glazing = glazing_by_id(tables, element.glazing_id)
    glazing_u = _glazing_u_value(glazing)
    if glazing_u is None:
        warnings.append(
            ApertureUValueWarning(
                kind="missing_glazing",
                element_id=element.id,
                message=_missing_glazing_message(element.glazing_id, element.id),
            )
        )

    if any(frames[side] is None for side in APERTURE_SIDES) or glazing_u is None:
        return _uncomputed_detail(
            element,
            width_m,
            height_m,
            frame_ids,
            frame_refs,
            glazing,
            warnings,
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
        return _uncomputed_detail(
            element,
            width_m,
            height_m,
            frame_ids,
            frame_refs,
            glazing,
            warnings,
            interior_width_m=interior_width,
            interior_height_m=interior_height,
            frame_area_m2=round(total_area, 6),
        )

    edges = (
        _edge_breakdown("top", f_top, f_left, f_right, width_m, interior_width),
        _edge_breakdown("right", f_right, f_top, f_bottom, height_m, interior_height),
        _edge_breakdown("bottom", f_bottom, f_left, f_right, width_m, interior_width),
        _edge_breakdown("left", f_left, f_top, f_bottom, height_m, interior_height),
    )
    glazing_area = interior_width * interior_height
    frame_area = total_area - glazing_area
    q_glazing = glazing_area * glazing_u
    q_frame = 0.0
    q_spacer = 0.0
    for edge in edges:
        assert edge.q_frame_w_k is not None  # noqa: S101 — complete edge invariant
        assert edge.q_spacer_w_k is not None  # noqa: S101 — complete edge invariant
        q_frame += edge.q_frame_w_k
        q_spacer += edge.q_spacer_w_k
    element_u = (q_glazing + q_frame + q_spacer) / total_area if total_area > 0 else 0.0

    return ApertureElementDetail(
        element_id=element.id,
        glazing_id=element.glazing_id,
        glazing_u_w_m2k=glazing_u,
        glazing_g_value=glazing.g_value if glazing else None,
        width_m=width_m,
        height_m=height_m,
        interior_width_m=interior_width,
        interior_height_m=interior_height,
        u_value_w_m2k=round(element_u, 4),
        area_m2=round(total_area, 6),
        glazing_area_m2=round(glazing_area, 6),
        frame_area_m2=round(frame_area, 6),
        q_glazing_w_k=q_glazing,
        q_frame_total_w_k=q_frame,
        q_spacer_total_w_k=q_spacer,
        edges=edges,
        warnings=warnings,
    )


def _uncomputed_detail(
    element: ApertureElement,
    width_m: float,
    height_m: float,
    frame_ids: dict[ApertureSide, str | None],
    frame_refs: dict[ApertureSide, ProjectFrame | None],
    glazing: ProjectGlazing | None,
    warnings: list[ApertureUValueWarning],
    *,
    interior_width_m: float | None = None,
    interior_height_m: float | None = None,
    frame_area_m2: float = 0.0,
) -> ApertureElementDetail:
    return ApertureElementDetail(
        element_id=element.id,
        glazing_id=element.glazing_id,
        glazing_u_w_m2k=glazing.u_value_w_m2k if glazing else None,
        glazing_g_value=glazing.g_value if glazing else None,
        width_m=width_m,
        height_m=height_m,
        interior_width_m=interior_width_m,
        interior_height_m=interior_height_m,
        u_value_w_m2k=0.0,
        area_m2=round(width_m * height_m, 6),
        glazing_area_m2=0.0,
        frame_area_m2=frame_area_m2,
        q_glazing_w_k=None,
        q_frame_total_w_k=None,
        q_spacer_total_w_k=None,
        edges=tuple(
            _edge_input(
                side,
                frame_ids[side],
                frame_refs[side],
                width_m if side in ("top", "bottom") else height_m,
            )
            for side in APERTURE_SIDES
        ),
        warnings=warnings,
    )


def _edge_input(
    side: ApertureSide,
    frame_id: str | None,
    frame: ProjectFrame | None,
    edge_length_m: float,
) -> ApertureEdgeBreakdown:
    return ApertureEdgeBreakdown(
        side=side,
        frame_id=frame_id,
        width_m=frame.width_mm / 1000.0 if frame and frame.width_mm is not None else None,
        u_value_w_m2k=frame.u_value_w_m2k if frame else None,
        psi_g_w_mk=frame.psi_g_w_mk if frame else None,
        psi_install_w_mk=frame.psi_install_w_mk if frame else None,
        edge_length_m=edge_length_m,
        interior_length_m=None,
        center_strip_area_m2=None,
        corner_area_a_m2=None,
        corner_area_b_m2=None,
        frame_area_m2=None,
        q_frame_w_k=None,
        q_spacer_w_k=None,
    )


def _edge_breakdown(
    side: ApertureSide,
    frame: _FrameData,
    adj_a: _FrameData,
    adj_b: _FrameData,
    edge_length_m: float,
    interior_length_m: float,
) -> ApertureEdgeBreakdown:
    """Apply PHN's 45-degree split: half of each corner goes to each edge."""
    center = frame.width_m * interior_length_m
    corner_a = (frame.width_m * adj_a.width_m) / 2.0
    corner_b = (frame.width_m * adj_b.width_m) / 2.0
    frame_area = center + corner_a + corner_b
    return ApertureEdgeBreakdown(
        side=side,
        frame_id=frame.frame_id,
        width_m=frame.width_m,
        u_value_w_m2k=frame.u_value_w_m2k,
        psi_g_w_mk=frame.psi_g_w_mk,
        psi_install_w_mk=frame.psi_install_w_mk,
        edge_length_m=edge_length_m,
        interior_length_m=interior_length_m,
        center_strip_area_m2=center,
        corner_area_a_m2=corner_a,
        corner_area_b_m2=corner_b,
        frame_area_m2=frame_area,
        q_frame_w_k=frame_area * frame.u_value_w_m2k,
        q_spacer_w_k=interior_length_m * frame.psi_g_w_mk,
    )


def _frame_warnings(
    element_id: str,
    frame_ids: dict[ApertureSide, str | None],
    frame_refs: dict[ApertureSide, ProjectFrame | None],
) -> list[ApertureUValueWarning]:
    warnings: list[ApertureUValueWarning] = []
    for side in APERTURE_SIDES:
        frame_id = frame_ids[side]
        frame = frame_refs[side]
        if frame_id is None:
            warnings.append(
                ApertureUValueWarning(
                    kind="missing_frame",
                    element_id=element_id,
                    side=side,
                    message=f"Element {element_id} is missing a {side} frame assignment.",
                )
            )
            continue
        if frame is None:
            warnings.append(
                ApertureUValueWarning(
                    kind="missing_frame",
                    element_id=element_id,
                    side=side,
                    message=f"Element {element_id}'s {side} frame assignment {frame_id} does not exist.",
                )
            )
            continue
        missing_fields = [
            field for field in ("width_mm", "u_value_w_m2k", "psi_g_w_mk") if getattr(frame, field) is None
        ]
        if missing_fields:
            warnings.append(
                ApertureUValueWarning(
                    kind="incomplete_frame_data",
                    element_id=element_id,
                    side=side,
                    message=(f"Element {element_id}'s {side} frame {frame_id} is missing {', '.join(missing_fields)}."),
                )
            )
    return warnings


def _void_boundary_warnings(
    element_id: str,
    frame_refs: dict[ApertureSide, ProjectFrame | None],
    void_adjacent_sides: tuple[ApertureSide, ...],
) -> list[ApertureUValueWarning]:
    warnings: list[ApertureUValueWarning] = []
    for side in void_adjacent_sides:
        frame = frame_refs[side]
        if frame is None or not frame.mull_type:
            continue
        warnings.append(
            ApertureUValueWarning(
                kind="mullion_frame_at_void_boundary",
                element_id=element_id,
                side=side,
                message=(
                    f"Element {element_id} has a mullion frame on its {side} edge next to an Empty panel; "
                    "re-check the jamb, sill, or head frame assignment."
                ),
            )
        )
    return warnings


def _element_width_m(entry: ApertureTypeEntry, element: ApertureElement) -> float:
    column_start, column_end = element.column_span
    return sum(entry.column_widths_mm[column_start : column_end + 1]) / 1000.0


def _element_height_m(entry: ApertureTypeEntry, element: ApertureElement) -> float:
    row_start, row_end = element.row_span
    return sum(entry.row_heights_mm[row_start : row_end + 1]) / 1000.0


def _frame_data(frame_id: str | None, frame: ProjectFrame | None) -> _FrameData | None:
    if frame_id is None or frame is None:
        return None
    if frame.width_mm is None or frame.u_value_w_m2k is None or frame.psi_g_w_mk is None:
        return None
    return _FrameData(
        frame_id=frame_id,
        width_m=frame.width_mm / 1000.0,
        u_value_w_m2k=frame.u_value_w_m2k,
        psi_g_w_mk=frame.psi_g_w_mk,
        psi_install_w_mk=frame.psi_install_w_mk,
    )


def _glazing_u_value(glazing: ProjectGlazing | None) -> float | None:
    if glazing is None or glazing.u_value_w_m2k is None:
        return None
    return glazing.u_value_w_m2k


def _missing_glazing_message(glazing_id: str | None, element_id: str) -> str:
    if glazing_id is None:
        return f"Element {element_id} is missing a glazing assignment."
    return f"Element {element_id}'s glazing assignment {glazing_id} is incomplete or does not exist."
