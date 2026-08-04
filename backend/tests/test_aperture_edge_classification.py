"""Perimeter-vs-interior classification of aperture-element edges (D-3).

Pure-geometry cases from the phase-01 plan: single element, side-by-side
mull, 2x2 grid, span adjacency, void neighbours, and an L-shaped mixed
adjacency where a side abuts both glazed and void cells.

Paired with ``frontend/src/features/apertures/__tests__/
edge-classification.test.ts`` — the TS suite copies these case tables
verbatim; update both together.
"""

from __future__ import annotations

from features.project_document.aperture_commands.models import ApertureSide
from features.project_document.apertures.edge_classification import EdgeClass, classify_element_edges
from features.project_document.document import ApertureElement, ApertureTypeEntry


def _entry(
    *,
    rows: list[float],
    cols: list[float],
    elements: list[ApertureElement],
) -> ApertureTypeEntry:
    return ApertureTypeEntry(
        id="apt_test",
        name="Test",
        row_heights_mm=rows,
        column_widths_mm=cols,
        elements=elements,
    )


def _element(
    element_id: str,
    row_span: tuple[int, int],
    column_span: tuple[int, int],
    *,
    kind: str = "glazed",
) -> ApertureElement:
    return ApertureElement.model_validate(
        {"id": element_id, "kind": kind, "row_span": row_span, "column_span": column_span}
    )


_ALL_SIDES: tuple[ApertureSide, ...] = ("top", "right", "bottom", "left")


def _sides(classes: dict[tuple[str, ApertureSide], EdgeClass], element_id: str) -> dict[str, str]:
    return {side: classes[(element_id, side)] for side in _ALL_SIDES}


def test_single_element_is_perimeter_on_all_sides() -> None:
    entry = _entry(rows=[1000.0], cols=[800.0], elements=[_element("aptel_a", (0, 0), (0, 0))])
    assert _sides(classify_element_edges(entry), "aptel_a") == {
        "top": "perimeter",
        "right": "perimeter",
        "bottom": "perimeter",
        "left": "perimeter",
    }


def test_side_by_side_mull_is_interior_on_the_shared_edge() -> None:
    entry = _entry(
        rows=[1000.0],
        cols=[800.0, 800.0],
        elements=[_element("aptel_l", (0, 0), (0, 0)), _element("aptel_r", (0, 0), (1, 1))],
    )
    classes = classify_element_edges(entry)
    assert _sides(classes, "aptel_l") == {
        "top": "perimeter",
        "right": "interior",
        "bottom": "perimeter",
        "left": "perimeter",
    }
    assert _sides(classes, "aptel_r") == {
        "top": "perimeter",
        "right": "perimeter",
        "bottom": "perimeter",
        "left": "interior",
    }


def test_two_by_two_grid_each_element_has_two_interior_sides() -> None:
    entry = _entry(
        rows=[600.0, 600.0],
        cols=[800.0, 800.0],
        elements=[
            _element("aptel_tl", (0, 0), (0, 0)),
            _element("aptel_tr", (0, 0), (1, 1)),
            _element("aptel_bl", (1, 1), (0, 0)),
            _element("aptel_br", (1, 1), (1, 1)),
        ],
    )
    classes = classify_element_edges(entry)
    assert _sides(classes, "aptel_tl") == {
        "top": "perimeter",
        "right": "interior",
        "bottom": "interior",
        "left": "perimeter",
    }
    assert _sides(classes, "aptel_br") == {
        "top": "interior",
        "right": "perimeter",
        "bottom": "perimeter",
        "left": "interior",
    }


def test_spanning_element_beside_two_singles_is_interior_across_the_full_edge() -> None:
    # One 2x1 element occupying the left column of a 2x2 grid, two 1x1s on
    # the right: the spanning element's right side abuts both singles.
    entry = _entry(
        rows=[600.0, 600.0],
        cols=[800.0, 800.0],
        elements=[
            _element("aptel_span", (0, 1), (0, 0)),
            _element("aptel_top", (0, 0), (1, 1)),
            _element("aptel_bottom", (1, 1), (1, 1)),
        ],
    )
    classes = classify_element_edges(entry)
    assert _sides(classes, "aptel_span") == {
        "top": "perimeter",
        "right": "interior",
        "bottom": "perimeter",
        "left": "perimeter",
    }
    assert classes[("aptel_top", "left")] == "interior"
    assert classes[("aptel_bottom", "left")] == "interior"


def test_void_neighbour_counts_as_perimeter() -> None:
    entry = _entry(
        rows=[1000.0],
        cols=[800.0, 800.0],
        elements=[_element("aptel_glazed", (0, 0), (0, 0)), _element("aptel_void", (0, 0), (1, 1), kind="void")],
    )
    classes = classify_element_edges(entry)
    # The glazed element's shared edge abuts a void panel: still an install edge.
    assert classes[("aptel_glazed", "right")] == "perimeter"
    # Void elements classify too (all perimeter) so callers need no kind branch.
    assert _sides(classes, "aptel_void") == {
        "top": "perimeter",
        "right": "perimeter",
        "bottom": "perimeter",
        "left": "perimeter",
    }


def test_l_shaped_mixed_adjacency_is_perimeter() -> None:
    # 2x2 grid: a 2x1 glazed span on the left; the right column stacks one
    # glazed and one void. The span's right side abuts glazed AND void cells,
    # so it stays perimeter — only a fully mulled side is interior.
    entry = _entry(
        rows=[600.0, 600.0],
        cols=[800.0, 800.0],
        elements=[
            _element("aptel_span", (0, 1), (0, 0)),
            _element("aptel_glazed", (0, 0), (1, 1)),
            _element("aptel_void", (1, 1), (1, 1), kind="void"),
        ],
    )
    classes = classify_element_edges(entry)
    assert classes[("aptel_span", "right")] == "perimeter"
    # The fully glazed-abutting counterpart side is still a mull.
    assert classes[("aptel_glazed", "left")] == "interior"
    assert classes[("aptel_void", "left")] == "perimeter"
