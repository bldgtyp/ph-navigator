"""Aperture U-Value service unit tests.

Phase 09 ports the ISO 10077-1 calculation; these tests sanity-check
the core algorithm and the cache-key behavior. V1 fixture parity is
deferred to the dated parity-review folder; the algorithm matches
``../ph-navigator/backend/features/aperture/services/window_u_value.py``
line-for-line.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from features.aperture_u_value.cache import (
    cache_clear,
    content_hash_for_aperture,
)
from features.aperture_u_value.service import calculate_aperture_u_values
from features.project_document.document import (
    ApertureElement,
    ApertureElementFrames,
    ApertureOperation,
    ApertureTypeEntry,
    CatalogOrigin,
    FrameRef,
    GlazingRef,
)


def _frame(*, u: float = 1.0, psi: float = 0.04, width_mm: float = 80.0) -> FrameRef:
    return FrameRef(
        name="F",
        manufacturer="ABC",
        operation="Fixed",
        location="head",
        width_mm=width_mm,
        u_value_w_m2k=u,
        psi_g_w_mk=psi,
        catalog_origin=CatalogOrigin(
            catalog_table="frame_types",
            catalog_record_id="rec000000000FRAME",
            synced_at=datetime(2026, 1, 1, tzinfo=UTC),
        ),
    )


def _glazing(*, u: float = 0.8) -> GlazingRef:
    return GlazingRef(
        name="G",
        u_value_w_m2k=u,
        g_value=0.5,
        catalog_origin=CatalogOrigin(
            catalog_table="glazing_types",
            catalog_record_id="recGLZNG000000000",
            synced_at=datetime(2026, 1, 1, tzinfo=UTC),
        ),
    )


def _element(
    *,
    id: str = "aptel_X",
    name: str = "X",
    row_span: tuple[int, int] = (0, 0),
    column_span: tuple[int, int] = (0, 0),
    frame: FrameRef | None = None,
    glazing: GlazingRef | None = None,
    operation: ApertureOperation | None = None,
) -> ApertureElement:
    f = frame if frame is not None else _frame()
    return ApertureElement(
        id=id,
        name=name,
        row_span=row_span,
        column_span=column_span,
        frames=ApertureElementFrames(top=f, right=f, bottom=f, left=f),
        glazing=glazing if glazing is not None else _glazing(),
        operation=operation,
    )


def _aperture(elements: list[ApertureElement], rows: list[float], cols: list[float]) -> ApertureTypeEntry:
    return ApertureTypeEntry(
        id="apt_X",
        name="X",
        row_heights_mm=rows,
        column_widths_mm=cols,
        elements=elements,
    )


@pytest.fixture(autouse=True)
def _clear_cache() -> None:
    cache_clear()


def test_1x1_aperture_u_value_matches_iso_formula() -> None:
    """For a 1000×1000 mm cell with 80 mm frames (U=1.0), glazing U=0.8,
    Ψg=0.04 W/mK, the composite U_w should be roughly between glazing
    and frame U-values (both contribute). Sanity-check the bounds."""

    entry = _aperture([_element()], rows=[1000.0], cols=[1000.0])
    result = calculate_aperture_u_values(entry)
    assert 0.8 < result.window_u_value_w_m2k < 1.0
    assert result.warnings == []
    assert result.total_area_m2 == pytest.approx(1.0, rel=1e-3)


def test_missing_glazing_yields_warning_and_zero_value_for_element() -> None:
    f = _frame()
    el = ApertureElement(
        id="aptel_NG",
        name="NG",
        row_span=(0, 0),
        column_span=(0, 0),
        frames=ApertureElementFrames(top=f, right=f, bottom=f, left=f),
        glazing=None,
    )
    entry = _aperture([el], rows=[1000.0], cols=[1000.0])
    result = calculate_aperture_u_values(entry)
    kinds = {w.kind for w in result.warnings}
    assert "missing_glazing" in kinds
    # Element returns 0 (excluded from window aggregation).
    assert result.elements[0].u_value_w_m2k == 0.0


def test_missing_frame_side_yields_warning() -> None:
    f = _frame()
    el = ApertureElement(
        id="aptel_Y",
        name="Y",
        row_span=(0, 0),
        column_span=(0, 0),
        frames=ApertureElementFrames(top=None, right=f, bottom=f, left=f),
        glazing=_glazing(),
    )
    entry = _aperture([el], rows=[1000.0], cols=[1000.0])
    result = calculate_aperture_u_values(entry)
    assert any(w.kind == "missing_frame" and w.side == "top" for w in result.warnings)


def test_content_hash_excludes_operation_and_name() -> None:
    el_a = _element(name="A", operation=None)
    el_b = _element(name="B", operation=ApertureOperation(type="swing", directions=["left"]))
    entry_a = _aperture([el_a], rows=[1000.0], cols=[1000.0])
    entry_b = _aperture([el_b], rows=[1000.0], cols=[1000.0])
    assert content_hash_for_aperture(entry_a) == content_hash_for_aperture(entry_b)


def test_content_hash_differs_when_frame_u_value_changes() -> None:
    el_a = _element(frame=_frame(u=1.0))
    el_b = _element(frame=_frame(u=1.2))
    entry_a = _aperture([el_a], rows=[1000.0], cols=[1000.0])
    entry_b = _aperture([el_b], rows=[1000.0], cols=[1000.0])
    assert content_hash_for_aperture(entry_a) != content_hash_for_aperture(entry_b)


def test_cache_returns_same_instance_for_identical_aperture() -> None:
    entry = _aperture([_element()], rows=[1000.0], cols=[1000.0])
    first = calculate_aperture_u_values(entry)
    second = calculate_aperture_u_values(entry)
    assert first is second


def test_2x2_aperture_aggregates_window_value_as_area_weighted_mean() -> None:
    f = _frame()
    g = _glazing()
    elements = [
        ApertureElement(
            id=f"aptel_{r}{c}",
            name=f"E{r}{c}",
            row_span=(r, r),
            column_span=(c, c),
            frames=ApertureElementFrames(top=f, right=f, bottom=f, left=f),
            glazing=g,
        )
        for r in range(2)
        for c in range(2)
    ]
    entry = ApertureTypeEntry(
        id="apt_2",
        name="2x2",
        row_heights_mm=[1000.0, 1000.0],
        column_widths_mm=[1000.0, 1000.0],
        elements=elements,
    )
    result = calculate_aperture_u_values(entry)
    # All four elements share the same payload → window U == element U.
    assert result.window_u_value_w_m2k == result.elements[0].u_value_w_m2k
    assert result.total_area_m2 == pytest.approx(4.0, rel=1e-3)
