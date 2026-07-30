"""Report service and REST wiring tests for aperture U-value audit detail."""

from __future__ import annotations

from typing import cast
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from features.aperture_u_value.report import (
    REPORT_GENERATED_NOTE,
    build_aperture_u_value_report,
)
from features.aperture_u_value.service import calculate_aperture_u_values
from features.project_document.document import (
    ApertureElement,
    ApertureElementFrames,
    ApertureTypeEntry,
)
from main import app
from tests.test_aperture_u_value_parity import (
    _element,
    _frames,
    _tables,
)
from tests.test_apertures_mcp import _seed_aperture
from tests.test_mcp import clean_mcp_tables, create_project, signed_in_client

__all__ = ["clean_mcp_tables"]

PROJECT_ID = UUID("00000000-0000-0000-0000-000000000001")
VERSION_ID = UUID("00000000-0000-0000-0000-000000000002")


def _report(entry: ApertureTypeEntry):
    tables = _tables()
    tables.apertures = [entry]
    return build_aperture_u_value_report(
        project_id=PROJECT_ID,
        version_id=VERSION_ID,
        source="draft",
        project_name="Synthetic Project",
        bt_number="TEST-01",
        version_label="Working v0",
        tables=tables,
    )


def test_report_joins_names_positions_and_exact_chip_rollup() -> None:
    entry = ApertureTypeEntry(
        id="apt_report",
        name="Report",
        row_heights_mm=[1000.0],
        column_widths_mm=[800.0, 1200.0],
        elements=[
            _element("aptel_left", column=0),
            _element("aptel_right", column=1, glazing_id="pglz_b"),
        ],
    )
    tables = _tables()
    tables.apertures = [entry]
    report = build_aperture_u_value_report(
        project_id=PROJECT_ID,
        version_id=VERSION_ID,
        source="draft",
        project_name="Synthetic Project",
        bt_number="TEST-01",
        version_label="Working v0",
        tables=tables,
    )
    section = report.apertures[0]

    assert (
        section.window_u_value_w_m2k
        == calculate_aperture_u_values(
            entry,
            tables,
        ).window_u_value_w_m2k
    )
    assert section.shgc_glazing_area_weighted == pytest.approx((0.45 * 0.5561 + 0.55 * 0.8881) / (0.5561 + 0.8881))
    assert section.overall_width_m == 2.0
    assert section.overall_height_m == 1.0
    assert [element.grid_label for element in section.elements] == ["C0_R0", "C1_R0"]
    assert [element.element_name for element in section.elements] == [
        "aptel_left",
        "aptel_right",
    ]
    assert section.elements[0].glazing_name == "pglz_a"
    assert [edge.frame_name for edge in section.elements[0].edges] == [
        "pfrm_top",
        "pfrm_right",
        "pfrm_bottom",
        "pfrm_left",
    ]
    assert report.provenance.generated_note == REPORT_GENERATED_NOTE


def test_report_counts_void_and_unfinished_elements() -> None:
    entry = ApertureTypeEntry(
        id="apt_states",
        name="States",
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0, 1000.0, 500.0],
        elements=[
            _element("aptel_complete", column=0),
            _element(
                "aptel_incomplete",
                column=1,
                frames=_frames(top="pfrm_incomplete"),
            ),
            ApertureElement(
                id="aptel_void",
                name="Empty",
                kind="void",
                row_span=(0, 0),
                column_span=(2, 2),
            ),
        ],
    )
    section = _report(entry).apertures[0]

    assert section.element_count == 3
    assert section.void_count == 1
    assert section.unfinished_count == 1
    assert len(section.elements) == 2
    assert section.elements[0].unfinished is False
    assert section.elements[1].unfinished is True
    assert [warning.kind for warning in section.elements[1].warnings] == ["incomplete_frame_data"]


def test_missing_shgc_warns_without_marking_element_unfinished() -> None:
    entry = ApertureTypeEntry(
        id="apt_shgc",
        name="SHGC",
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
        elements=[_element("aptel_shgc")],
    )
    tables = _tables()
    tables.project_glazings[0].g_value = None
    tables.apertures = [entry]

    section = build_aperture_u_value_report(
        project_id=PROJECT_ID,
        version_id=VERSION_ID,
        source="version",
        project_name="Synthetic Project",
        bt_number="TEST-01",
        version_label="Submitted",
        tables=tables,
    ).apertures[0]

    assert section.shgc_glazing_area_weighted is None
    assert section.unfinished_count == 0
    assert section.elements[0].unfinished is False
    assert [warning.kind for warning in section.warnings] == ["missing_glazing_g_value"]


def test_report_is_not_stale_when_product_name_changes() -> None:
    entry = ApertureTypeEntry(
        id="apt_names",
        name="Names",
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
        elements=[_element("aptel_names")],
    )
    tables = _tables()
    tables.apertures = [entry]
    first = build_aperture_u_value_report(
        project_id=PROJECT_ID,
        version_id=VERSION_ID,
        source="draft",
        project_name="Synthetic Project",
        bt_number="TEST-01",
        version_label="Working",
        tables=tables,
    )
    first_hash = calculate_aperture_u_values(entry, tables).content_hash
    tables.project_frames[0].name = "Renamed top frame"
    second = build_aperture_u_value_report(
        project_id=PROJECT_ID,
        version_id=VERSION_ID,
        source="draft",
        project_name="Synthetic Project",
        bt_number="TEST-01",
        version_label="Working",
        tables=tables,
    )

    assert calculate_aperture_u_values(entry, tables).content_hash == first_hash
    assert first.apertures[0].elements[0].edges[0].frame_name == "pfrm_top"
    assert second.apertures[0].elements[0].edges[0].frame_name == "Renamed top frame"


def test_missing_frame_reference_keeps_endpoint_shape_and_flags_unfinished() -> None:
    entry = ApertureTypeEntry(
        id="apt_deleted_frame",
        name="Deleted frame",
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
        elements=[
            _element(
                "aptel_deleted_frame",
                frames=ApertureElementFrames(
                    top="pfrm_deleted",
                    right="pfrm_right",
                    bottom="pfrm_bottom",
                    left="pfrm_left",
                ),
            )
        ],
    )
    section = _report(entry).apertures[0]

    assert section.unfinished_count == 1
    assert section.elements[0].edges[0].frame_name is None
    assert section.elements[0].warnings[0].kind == "missing_frame"


def test_report_route_supports_editor_draft_and_public_saved_version(
    clean_mcp_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    _seed_aperture(version_id)
    url = f"/api/v1/projects/{project_id}/versions/{version_id}/apertures/u-values/report"

    draft_response = client.get(url, params={"source": "draft"})
    version_response = TestClient(app).get(url, params={"source": "version"})

    assert draft_response.status_code == 200
    assert draft_response.json()["source"] == "draft"
    assert version_response.status_code == 200
    assert version_response.json()["source"] == "version"
    assert version_response.json()["apertures"][0]["name"] == "Type A"
