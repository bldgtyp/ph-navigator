"""Parity fixtures for the aperture U-value breakdown refactor."""

from __future__ import annotations

from typing import Any

import pytest

from features.aperture_u_value.cache import cache_clear
from features.aperture_u_value.service import (
    calculate_aperture_u_values,
    calculate_aperture_u_values_detailed,
)
from features.project_document.document import (
    ApertureElement,
    ApertureElementFrames,
    ApertureTypeEntry,
    ProjectDocumentTables,
    ProjectFrame,
    ProjectGlazing,
)


@pytest.fixture(autouse=True)
def _clear_cache() -> None:
    cache_clear()


def _frame(
    frame_id: str,
    *,
    width_mm: float | None,
    u_value_w_m2k: float | None,
    psi_g_w_mk: float | None,
    psi_install_w_mk: float | None = 0.01,
) -> ProjectFrame:
    return ProjectFrame(
        id=frame_id,
        name=frame_id,
        width_mm=width_mm,
        u_value_w_m2k=u_value_w_m2k,
        psi_g_w_mk=psi_g_w_mk,
        psi_install_w_mk=psi_install_w_mk,
    )


def _glazing(glazing_id: str, *, u_value_w_m2k: float, g_value: float) -> ProjectGlazing:
    return ProjectGlazing(
        id=glazing_id,
        name=glazing_id,
        u_value_w_m2k=u_value_w_m2k,
        g_value=g_value,
    )


def _tables() -> ProjectDocumentTables:
    return ProjectDocumentTables(
        project_frames=[
            _frame("pfrm_top", width_mm=80.0, u_value_w_m2k=1.0, psi_g_w_mk=0.04),
            _frame("pfrm_right", width_mm=70.0, u_value_w_m2k=1.1, psi_g_w_mk=0.05),
            _frame("pfrm_bottom", width_mm=90.0, u_value_w_m2k=1.2, psi_g_w_mk=0.06),
            _frame("pfrm_left", width_mm=60.0, u_value_w_m2k=1.3, psi_g_w_mk=0.07),
            _frame("pfrm_incomplete", width_mm=80.0, u_value_w_m2k=1.0, psi_g_w_mk=None),
            _frame("pfrm_wide", width_mm=600.0, u_value_w_m2k=1.0, psi_g_w_mk=0.04),
        ],
        project_glazings=[
            _glazing("pglz_a", u_value_w_m2k=0.7, g_value=0.45),
            _glazing("pglz_b", u_value_w_m2k=0.9, g_value=0.55),
        ],
    )


def _frames(**overrides: str | None) -> ApertureElementFrames:
    ids: dict[str, str | None] = {
        "top": "pfrm_top",
        "right": "pfrm_right",
        "bottom": "pfrm_bottom",
        "left": "pfrm_left",
    }
    ids.update(overrides)
    return ApertureElementFrames(**ids)


def _element(
    element_id: str,
    *,
    row: int = 0,
    column: int = 0,
    frames: ApertureElementFrames | None = None,
    glazing_id: str | None = "pglz_a",
) -> ApertureElement:
    return ApertureElement(
        id=element_id,
        name=element_id,
        row_span=(row, row),
        column_span=(column, column),
        frames=frames or _frames(),
        glazing_id=glazing_id,
    )


def _snapshot(entry: ApertureTypeEntry, tables: ProjectDocumentTables) -> dict[str, Any]:
    return calculate_aperture_u_values(entry, tables).model_dump(mode="json")


def test_single_element_asymmetric_frame_snapshot() -> None:
    entry = ApertureTypeEntry(
        id="apt_asymmetric",
        name="Asymmetric",
        row_heights_mm=[1000.0],
        column_widths_mm=[1200.0],
        elements=[_element("aptel_asymmetric")],
    )

    assert _snapshot(entry, _tables()) == {
        "aperture_type_id": "apt_asymmetric",
        "window_u_value_w_m2k": 0.9862,
        "total_area_m2": 1.2,
        "elements": [
            {
                "element_id": "aptel_asymmetric",
                "u_value_w_m2k": 0.9862,
                "area_m2": 1.2,
                "glazing_area_m2": 0.8881,
                "frame_area_m2": 0.3119,
                "warnings": [],
            }
        ],
        "warnings": [],
        "content_hash": "120248e960c8fa76d2a43d02f7453f6cacd0c0a1029646f232569926571d6e51",
    }


def test_two_by_two_mixed_glazing_snapshot() -> None:
    entry = ApertureTypeEntry(
        id="apt_grid",
        name="Grid",
        row_heights_mm=[900.0, 1100.0],
        column_widths_mm=[800.0, 1200.0],
        elements=[
            _element("aptel_00", row=0, column=0),
            _element("aptel_01", row=0, column=1, glazing_id="pglz_b"),
            _element("aptel_10", row=1, column=0, glazing_id="pglz_b"),
            _element("aptel_11", row=1, column=1),
        ],
    )

    result = _snapshot(entry, _tables())
    assert result["window_u_value_w_m2k"] == 1.0799
    assert result["total_area_m2"] == 4.0
    assert [
        (
            item["element_id"],
            item["u_value_w_m2k"],
            item["area_m2"],
            item["glazing_area_m2"],
            item["frame_area_m2"],
        )
        for item in result["elements"]
    ] == [
        ("aptel_00", 1.0576, 0.72, 0.4891, 0.2309),
        ("aptel_01", 1.1456, 1.08, 0.7811, 0.2989),
        ("aptel_10", 1.176, 0.88, 0.6231, 0.2569),
        ("aptel_11", 0.9741, 1.32, 0.9951, 0.3249),
    ]
    assert result["warnings"] == []
    assert result["content_hash"] == "8e2d36edd9e765844781aa82a631075919aa673e2c63c0327932839e3cea8c6c"


@pytest.mark.parametrize(
    ("entry", "expected_kind", "expected_hash"),
    [
        (
            ApertureTypeEntry(
                id="apt_unassigned",
                name="Unassigned",
                row_heights_mm=[1000.0],
                column_widths_mm=[1000.0],
                elements=[_element("aptel_unassigned", frames=_frames(top=None))],
            ),
            "missing_frame",
            "94da45ccb38b12774431e50fa22de68f46e446ea4eb96e5b6e7a06afb0c36385",
        ),
        (
            ApertureTypeEntry(
                id="apt_incomplete",
                name="Incomplete",
                row_heights_mm=[1000.0],
                column_widths_mm=[1000.0],
                elements=[_element("aptel_incomplete", frames=_frames(top="pfrm_incomplete"))],
            ),
            "incomplete_frame_data",
            "c9d510d0ad4c7f71e841ce31bdf7362fe346825a9291dd772ccd4fb284f29ba1",
        ),
        (
            ApertureTypeEntry(
                id="apt_missing_glazing",
                name="Missing glazing",
                row_heights_mm=[1000.0],
                column_widths_mm=[1000.0],
                elements=[_element("aptel_missing_glazing", glazing_id=None)],
            ),
            "missing_glazing",
            "6cd64885d0cfc476481e68e1f4638f029e019020aa7ef2a7f9ab5917e9c8f12d",
        ),
    ],
)
def test_unfinished_element_snapshots(
    entry: ApertureTypeEntry,
    expected_kind: str,
    expected_hash: str,
) -> None:
    result = _snapshot(entry, _tables())
    assert result["window_u_value_w_m2k"] == 0.0
    assert result["total_area_m2"] == 1.0
    assert result["elements"][0] == {
        "element_id": entry.elements[0].id,
        "u_value_w_m2k": 0.0,
        "area_m2": 1.0,
        "glazing_area_m2": 0.0,
        "frame_area_m2": 0.0,
        "warnings": result["warnings"],
    }
    assert [warning["kind"] for warning in result["warnings"]] == [expected_kind]
    assert result["content_hash"] == expected_hash


def test_non_positive_glazing_area_snapshot() -> None:
    entry = ApertureTypeEntry(
        id="apt_non_positive",
        name="Non-positive",
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
        elements=[
            _element(
                "aptel_non_positive",
                frames=ApertureElementFrames(
                    top="pfrm_wide",
                    right="pfrm_wide",
                    bottom="pfrm_wide",
                    left="pfrm_wide",
                ),
            )
        ],
    )
    result = _snapshot(entry, _tables())
    assert result["window_u_value_w_m2k"] == 0.0
    assert result["elements"][0]["glazing_area_m2"] == 0.0
    assert result["elements"][0]["frame_area_m2"] == 1.0
    assert [warning["kind"] for warning in result["warnings"]] == ["non_positive_glazing_area"]
    assert result["content_hash"] == "c3dd4bbd7043523eaf0496699301261a9b33e5be5ff2706d90adc4833f7ad174"


def test_void_and_all_void_snapshots() -> None:
    mixed = ApertureTypeEntry(
        id="apt_void",
        name="Void",
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0, 500.0],
        elements=[
            _element("aptel_glazed", column=0),
            ApertureElement(
                id="aptel_void",
                name="Empty",
                kind="void",
                row_span=(0, 0),
                column_span=(1, 1),
            ),
        ],
    )
    all_void = ApertureTypeEntry(
        id="apt_all_void",
        name="All void",
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
        elements=[
            ApertureElement(
                id="aptel_only_void",
                name="Empty",
                kind="void",
                row_span=(0, 0),
                column_span=(0, 0),
            )
        ],
    )

    mixed_result = _snapshot(mixed, _tables())
    assert mixed_result["total_area_m2"] == 1.0
    assert [item["element_id"] for item in mixed_result["elements"]] == ["aptel_glazed"]
    assert mixed_result["content_hash"] == "f3c79aa0dbe4d1c81d84231ba2cbe331ea2df28ec8b39a49d71aeb6fb790cffc"

    all_void_result = _snapshot(all_void, _tables())
    assert all_void_result == {
        "aperture_type_id": "apt_all_void",
        "window_u_value_w_m2k": 0.0,
        "total_area_m2": 0.0,
        "elements": [],
        "warnings": [
            {
                "kind": "no_glazed_elements",
                "element_id": None,
                "side": None,
                "axis": None,
                "message": "Aperture type apt_all_void contains no glazed elements.",
            }
        ],
        "content_hash": "3dccf8ee3395f2996336bdec22ce1c4c8987ad030b82256ee4c437faccf3949d",
    }


def test_detailed_result_preserves_edge_area_and_heat_loss_invariants() -> None:
    entry = ApertureTypeEntry(
        id="apt_detail",
        name="Detail",
        row_heights_mm=[1000.0],
        column_widths_mm=[1200.0],
        elements=[_element("aptel_detail")],
    )
    detail = calculate_aperture_u_values_detailed(entry, _tables()).elements[0]
    edges = {edge.side: edge for edge in detail.edges}

    assert sum(edge.frame_area_m2 or 0.0 for edge in detail.edges) == pytest.approx(
        detail.frame_area_m2,
        abs=1e-6,
    )
    heat_loss = (detail.q_glazing_w_k or 0.0) + (detail.q_frame_total_w_k or 0.0) + (detail.q_spacer_total_w_k or 0.0)
    assert heat_loss / detail.area_m2 == pytest.approx(detail.u_value_w_m2k, abs=5e-5)
    assert edges["top"].corner_area_a_m2 == pytest.approx(edges["left"].corner_area_a_m2)
    assert edges["top"].corner_area_b_m2 == pytest.approx(edges["right"].corner_area_a_m2)
    assert edges["bottom"].corner_area_a_m2 == pytest.approx(edges["left"].corner_area_b_m2)
    assert edges["bottom"].corner_area_b_m2 == pytest.approx(edges["right"].corner_area_b_m2)


def test_detailed_unfinished_edges_keep_inputs_and_leave_results_blank() -> None:
    entry = ApertureTypeEntry(
        id="apt_detail_incomplete",
        name="Detail incomplete",
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
        elements=[_element("aptel_detail_incomplete", frames=_frames(top="pfrm_incomplete"))],
    )
    detail = calculate_aperture_u_values_detailed(entry, _tables()).elements[0]
    top = detail.edges[0]

    assert [warning.kind for warning in detail.warnings] == ["incomplete_frame_data"]
    assert top.frame_id == "pfrm_incomplete"
    assert top.width_m == 0.08
    assert top.u_value_w_m2k == 1.0
    assert top.psi_g_w_mk is None
    assert top.frame_area_m2 is None
    assert detail.q_glazing_w_k is None


def test_detailed_result_excludes_void_elements() -> None:
    entry = ApertureTypeEntry(
        id="apt_detail_void",
        name="Detail void",
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0, 500.0],
        elements=[
            _element("aptel_detail_glazed", column=0),
            ApertureElement(
                id="aptel_detail_void",
                name="Empty",
                kind="void",
                row_span=(0, 0),
                column_span=(1, 1),
            ),
        ],
    )

    result = calculate_aperture_u_values_detailed(entry, _tables())
    assert [element.element_id for element in result.elements] == ["aptel_detail_glazed"]
