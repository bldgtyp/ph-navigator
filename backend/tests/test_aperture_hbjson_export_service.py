"""HBJSON export service tests.

Pins the V1-shape payload via a JSON fixture and the collision /
missing-g-value contract behaviour. The fixture is the long-lived
contract; any V2 change requires a coordinated breaking-change
release per PRD §17 + §21 decision 17.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi import HTTPException

from features.aperture_hbjson_export.service import export_apertures
from features.aperture_u_value.cache import cache_clear
from features.project_document.apertures._ref_helpers import ensure_project_frame, ensure_project_glazing
from features.project_document.document import (
    ApertureElement,
    ApertureElementFrames,
    ApertureTypeEntry,
    CatalogOrigin,
    FrameRef,
    GlazingRef,
    ProjectDocumentTables,
)

_FIXTURES = Path(__file__).parent / "fixtures" / "aperture_hbjson_export"


@pytest.fixture(autouse=True)
def _clear_cache() -> None:
    cache_clear()


def _frame(width_mm: float = 80.0) -> FrameRef:
    return FrameRef(
        name="F",
        manufacturer="ABC",
        operation="Fixed",
        location="head",
        width_mm=width_mm,
        u_value_w_m2k=1.0,
        psi_g_w_mk=0.04,
        catalog_origin=CatalogOrigin(
            catalog_table="frame_types",
            catalog_record_id="rec000000000FRAME",
            synced_at=datetime(2026, 1, 1, tzinfo=UTC),
        ),
    )


def _glazing(*, g_value: float | None = None) -> GlazingRef:
    return GlazingRef(
        name="G",
        u_value_w_m2k=0.8,
        g_value=g_value,
        catalog_origin=CatalogOrigin(
            catalog_table="glazing_types",
            catalog_record_id="recGLZNG000000000",
            synced_at=datetime(2026, 1, 1, tzinfo=UTC),
        ),
    )


def _aperture(
    name: str,
    *,
    g_value: float | None = None,
    slug: str = "X",
) -> tuple[ApertureTypeEntry, ProjectDocumentTables]:
    tables = ProjectDocumentTables()
    f = _frame()
    frame_id = ensure_project_frame(tables, f)
    glazing_id = ensure_project_glazing(tables, _glazing(g_value=g_value))
    el = ApertureElement(
        id=f"aptel_{slug}",
        name=name,
        row_span=(0, 0),
        column_span=(0, 0),
        frames=ApertureElementFrames(top=frame_id, right=frame_id, bottom=frame_id, left=frame_id),
        glazing_id=glazing_id,
    )
    return (
        ApertureTypeEntry(
            id=f"apt_{slug}",
            name=name,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
            elements=[el],
        ),
        tables,
    )


def test_export_matches_v1_shape_fixture() -> None:
    """A 1000×1000 mm element with 80 mm Frames (U=1.0, Ψg=0.04) and
    glazing U=0.8 with null g_value emits the V1 fixture payload."""

    entry, tables = _aperture("Door A")
    result = export_apertures([entry], tables)
    expected = json.loads((_FIXTURES / "v1_shape.json").read_text())
    assert result == expected


def test_null_g_value_falls_back_to_0_5() -> None:
    entry, tables = _aperture("Door A", g_value=None)
    result = export_apertures([entry], tables)
    assert result["Door_A_C0_R0"]["materials"][0]["shgc"] == 0.5


def test_g_value_passthrough_when_set() -> None:
    entry, tables = _aperture("Door A", g_value=0.35)
    result = export_apertures([entry], tables)
    assert result["Door_A_C0_R0"]["materials"][0]["shgc"] == 0.35


def test_collision_raises_422_with_both_names() -> None:
    first, tables = _aperture("Door A", slug="A1")
    second, second_tables = _aperture("Door-A", slug="A2")
    tables.project_frames.extend(second_tables.project_frames)
    tables.project_glazings.extend(second_tables.project_glazings)
    with pytest.raises(HTTPException) as exc:
        export_apertures([first, second], tables)
    assert exc.value.status_code == 422
    detail = exc.value.detail
    assert isinstance(detail, dict)
    assert detail["error_code"] == "aperture_hbjson_identifier_collision"
    collisions = detail["details"]["collisions"]
    sources = {collisions[0]["first"], collisions[0]["second"]}
    assert sources == {"Door A", "Door-A"}


def test_vt_is_hardcoded_0_6() -> None:
    entry, tables = _aperture("Door A")
    result = export_apertures([entry], tables)
    assert result["Door_A_C0_R0"]["materials"][0]["vt"] == 0.6


def test_identifier_format_uses_column_and_row_span_origin() -> None:
    """Identifier suffix uses the (column_span[0], row_span[0]) origin
    of the element — the upper-left cell in the rectangle it covers."""

    f = _frame()
    tables = ProjectDocumentTables()
    frame_id = ensure_project_frame(tables, f)
    glazing_id = ensure_project_glazing(tables, _glazing(g_value=0.5))
    el = ApertureElement(
        id="aptel_X",
        name="X",
        row_span=(0, 1),
        column_span=(0, 2),
        frames=ApertureElementFrames(top=frame_id, right=frame_id, bottom=frame_id, left=frame_id),
        glazing_id=glazing_id,
    )
    entry = ApertureTypeEntry(
        id="apt_X",
        name="CW01",
        row_heights_mm=[1000.0, 1000.0],
        column_widths_mm=[1000.0, 1000.0, 1000.0],
        elements=[el],
    )
    result = export_apertures([entry], tables)
    assert "CW01_C0_R0" in result
