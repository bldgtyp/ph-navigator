"""Comparator tests — field-by-field FrameRef / GlazingRef vs catalog row."""

from __future__ import annotations

from datetime import UTC, datetime

from features.aperture_drift.comparator import compare_frame_ref, compare_glazing_ref
from features.project_document.document import CatalogOrigin, FrameRef, GlazingRef


def _origin(local_overrides: list[str] | None = None) -> CatalogOrigin:
    return CatalogOrigin(
        catalog_table="frame_types",
        catalog_record_id="rec000000000FRAME",
        synced_at=datetime(2026, 1, 1, tzinfo=UTC),
        local_overrides=local_overrides or [],
    )


def _glazing_origin(local_overrides: list[str] | None = None) -> CatalogOrigin:
    return CatalogOrigin(
        catalog_table="glazing_types",
        catalog_record_id="recGLZNG000000000",
        synced_at=datetime(2026, 1, 1, tzinfo=UTC),
        local_overrides=local_overrides or [],
    )


def _frame(**kwargs: object) -> FrameRef:
    defaults: dict[str, object] = {
        "name": "F1",
        "manufacturer": "ABC",
        "operation": "Fixed",
        "location": "head",
        "width_mm": 80.0,
        "u_value_w_m2k": 1.0,
        "psi_g_w_mk": 0.04,
        "catalog_origin": _origin(),
    }
    defaults.update(kwargs)
    return FrameRef(**defaults)  # type: ignore[arg-type]


def _frame_row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "name": "F1",
        "manufacturer": "ABC",
        "brand": None,
        "use": None,
        "operation": "Fixed",
        "location": "head",
        "mull_type": None,
        "prefix": None,
        "suffix": None,
        "material": None,
        "width_mm": 80.0,
        "u_value_w_m2k": 1.0,
        "psi_g_w_mk": 0.04,
        "psi_install_w_mk": None,
        "color": None,
        "source": None,
        "comments": None,
    }
    row.update(overrides)
    return row


def test_identical_ref_and_row_have_no_deltas() -> None:
    assert compare_frame_ref(_frame(), _frame_row()) == []


def test_thermal_field_delta_is_reported() -> None:
    deltas = compare_frame_ref(_frame(), _frame_row(u_value_w_m2k=1.2))
    assert len(deltas) == 1
    assert deltas[0].field_key == "u_value_w_m2k"
    assert deltas[0].catalog_value == 1.2
    assert deltas[0].yours_value == 1.0
    assert deltas[0].in_local_overrides is False


def test_local_override_field_is_flagged() -> None:
    ref = _frame(catalog_origin=_origin(local_overrides=["u_value_w_m2k"]))
    deltas = compare_frame_ref(ref, _frame_row(u_value_w_m2k=1.2))
    assert deltas[0].in_local_overrides is True


def test_float_tolerance_avoids_spurious_delta() -> None:
    """0.04 vs 0.0400 should not report a delta."""

    ref = _frame(psi_g_w_mk=0.04)
    row = _frame_row(psi_g_w_mk=0.04000000001)
    assert compare_frame_ref(ref, row) == []


def test_int_vs_float_equal_treated_as_match() -> None:
    ref = _frame(width_mm=80.0)
    row = _frame_row(width_mm=80)
    assert compare_frame_ref(ref, row) == []


def test_glazing_comparator_covers_g_value() -> None:
    ref = GlazingRef(
        name="G",
        manufacturer="Alpen",
        u_value_w_m2k=0.8,
        g_value=0.5,
        catalog_origin=_glazing_origin(),
    )
    row = {
        "name": "G",
        "manufacturer": "Alpen",
        "brand": None,
        "suffix": None,
        "u_value_w_m2k": 0.8,
        "g_value": 0.4,
        "color": None,
        "source": None,
        "comments": None,
    }
    deltas = compare_glazing_ref(ref, row)
    assert len(deltas) == 1
    assert deltas[0].field_key == "g_value"
    assert deltas[0].catalog_value == 0.4
    assert deltas[0].yours_value == 0.5


def test_multiple_field_deltas_reported_in_declaration_order() -> None:
    ref = _frame(manufacturer="ABC", u_value_w_m2k=1.0, psi_g_w_mk=0.04)
    deltas = compare_frame_ref(
        ref,
        _frame_row(manufacturer="XYZ", u_value_w_m2k=1.2, psi_g_w_mk=0.05),
    )
    keys = [d.field_key for d in deltas]
    assert keys == ["manufacturer", "u_value_w_m2k", "psi_g_w_mk"]
