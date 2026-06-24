"""Tests for ``setManufacturerFilters`` (Phase 11 commit 1).

Covers the in-use enforcement contract, the ``None`` vs empty list
semantics, and the document round-trip.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal, cast

import pytest
from fastapi import HTTPException

from features.project_document.aperture_commands.dispatcher import (
    apply_aperture_command,
)
from features.project_document.aperture_commands.models import SetManufacturerFilters
from features.project_document.apertures._ref_helpers import ensure_project_frame, ensure_project_glazing
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    ApertureElement,
    ApertureElementFrames,
    ApertureTypeEntry,
    CatalogOrigin,
    FrameRef,
    GlazingRef,
    ManufacturerFilters,
    ProjectDocumentTables,
    ProjectDocumentV1,
)
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document


class _Catalog:
    def get_default_frame(self) -> FrameRef | None:
        return None

    def get_default_glazing(self) -> GlazingRef | None:
        return None


def _catalog() -> DefaultsCatalogReader:
    return _Catalog()


def _origin(table: Literal["materials", "frame_types", "glazing_types"], rec: str) -> CatalogOrigin:
    return CatalogOrigin(
        catalog_table=table,
        catalog_record_id=rec,
        synced_at=datetime(2026, 6, 5, tzinfo=UTC),
    )


def _frame(manufacturer: str | None) -> FrameRef:
    return FrameRef(
        name="F",
        manufacturer=manufacturer,
        operation="Fixed",
        location="head",
        width_mm=80.0,
        u_value_w_m2k=1.0,
        psi_g_w_mk=0.04,
        catalog_origin=_origin("frame_types", "rec000000000FRAME"),
    )


def _glazing(manufacturer: str | None) -> GlazingRef:
    return GlazingRef(
        name="G",
        manufacturer=manufacturer,
        u_value_w_m2k=0.8,
        g_value=0.5,
        catalog_origin=_origin("glazing_types", "recGLZNG000000000"),
    )


def _empty_body() -> ProjectDocumentV1:
    return empty_project_document(CreateProjectRequest(name="P", bt_number="BT-1", cert_programs=[]))


def _body_with_picks(*, frame_manu: str | None, glazing_manu: str | None) -> ProjectDocumentV1:
    body = _empty_body()
    f = _frame(frame_manu)
    g = _glazing(glazing_manu)
    frame_id = ensure_project_frame(body.tables, f)
    glazing_id = ensure_project_glazing(body.tables, g)
    element = ApertureElement(
        id="aptel_A1",
        name="One",
        row_span=(0, 0),
        column_span=(0, 0),
        frames=ApertureElementFrames(top=frame_id, right=frame_id, bottom=frame_id, left=frame_id),
        glazing_id=glazing_id,
    )
    aperture = ApertureTypeEntry(
        id="apt_A",
        name="Type A",
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
        elements=[element],
    )
    return body.model_copy(update={"tables": body.tables.model_copy(update={"apertures": [aperture]})})


def _apply(body: ProjectDocumentV1, command: SetManufacturerFilters) -> ProjectDocumentV1:
    next_body, _audit = apply_aperture_command(
        body,
        command,
        actor_user_id="user-1",
        catalog=_catalog(),
    )
    return next_body


# ----------------------------- model defaults -----------------------------


def test_default_tables_manufacturer_filters_is_none() -> None:
    body = _empty_body()
    assert body.tables.manufacturer_filters is None


def test_legacy_list_placeholder_migrates_to_none() -> None:
    tables = ProjectDocumentTables.model_validate({"manufacturer_filters": []})
    assert tables.manufacturer_filters is None


# ----------------------------- happy paths --------------------------------


def test_none_enabled_lists_round_trip_as_all_on() -> None:
    body = _empty_body()
    result = _apply(
        body,
        SetManufacturerFilters(frame_manufacturers_enabled=None, glazing_manufacturers_enabled=None),
    )
    assert isinstance(result.tables.manufacturer_filters, ManufacturerFilters)
    assert result.tables.manufacturer_filters.frame_manufacturers_enabled is None
    assert result.tables.manufacturer_filters.glazing_manufacturers_enabled is None


def test_empty_lists_clear_all_when_nothing_in_use() -> None:
    body = _empty_body()
    result = _apply(
        body,
        SetManufacturerFilters(frame_manufacturers_enabled=[], glazing_manufacturers_enabled=[]),
    )
    assert result.tables.manufacturer_filters is not None
    assert result.tables.manufacturer_filters.frame_manufacturers_enabled == []
    assert result.tables.manufacturer_filters.glazing_manufacturers_enabled == []


def test_in_use_manufacturer_present_in_enabled_passes() -> None:
    body = _body_with_picks(frame_manu="Schüco", glazing_manu="Alpen")
    result = _apply(
        body,
        SetManufacturerFilters(
            frame_manufacturers_enabled=["Schüco", "Other"],
            glazing_manufacturers_enabled=["Alpen"],
        ),
    )
    assert result.tables.manufacturer_filters is not None
    assert result.tables.manufacturer_filters.frame_manufacturers_enabled == ["Other", "Schüco"]
    assert result.tables.manufacturer_filters.glazing_manufacturers_enabled == ["Alpen"]


def test_enabled_list_is_deduped_and_sorted_case_insensitively() -> None:
    body = _empty_body()
    result = _apply(
        body,
        SetManufacturerFilters(
            frame_manufacturers_enabled=["schüco", "Schüco", "Alpen", "  ", "Alpen "],
            glazing_manufacturers_enabled=None,
        ),
    )
    assert result.tables.manufacturer_filters is not None
    assert result.tables.manufacturer_filters.frame_manufacturers_enabled == ["Alpen", "schüco"]


# ----------------------------- in-use rejection ---------------------------


def test_disabling_in_use_frame_manufacturer_raises_422() -> None:
    body = _body_with_picks(frame_manu="Schüco", glazing_manu=None)
    with pytest.raises(HTTPException) as exc:
        _apply(
            body,
            SetManufacturerFilters(
                frame_manufacturers_enabled=["Alpen"],
                glazing_manufacturers_enabled=None,
            ),
        )
    assert exc.value.status_code == 422
    assert isinstance(exc.value.detail, dict)
    detail = cast(dict[str, object], exc.value.detail)
    assert detail["error_code"] == "manufacturer_filter_strands_frame_picks"
    details_frame = cast(dict[str, object], detail["details"])
    assert details_frame["in_use"] == ["Schüco"]


def test_disabling_in_use_glazing_manufacturer_raises_422() -> None:
    body = _body_with_picks(frame_manu=None, glazing_manu="Alpen")
    with pytest.raises(HTTPException) as exc:
        _apply(
            body,
            SetManufacturerFilters(
                frame_manufacturers_enabled=None,
                glazing_manufacturers_enabled=[],
            ),
        )
    assert exc.value.status_code == 422
    assert isinstance(exc.value.detail, dict)
    detail = cast(dict[str, object], exc.value.detail)
    assert detail["error_code"] == "manufacturer_filter_strands_glazing_picks"
    details_glazing = cast(dict[str, object], detail["details"])
    assert details_glazing["in_use"] == ["Alpen"]


def test_in_use_check_is_case_insensitive() -> None:
    """Passing the manufacturer with a different case still permits the save."""

    body = _body_with_picks(frame_manu="Schüco", glazing_manu=None)
    result = _apply(
        body,
        SetManufacturerFilters(
            frame_manufacturers_enabled=["SCHÜCO"],
            glazing_manufacturers_enabled=None,
        ),
    )
    assert result.tables.manufacturer_filters is not None
    assert result.tables.manufacturer_filters.frame_manufacturers_enabled == ["SCHÜCO"]


def test_audit_envelope_carries_affects_u_value_false() -> None:
    body = _empty_body()
    _next, audit = apply_aperture_command(
        body,
        SetManufacturerFilters(
            frame_manufacturers_enabled=["Alpen"],
            glazing_manufacturers_enabled=None,
        ),
        actor_user_id="user-1",
        catalog=_catalog(),
    )
    assert audit["action_kind"] == "project_version_aperture_manufacturer_filters_set"
    assert audit["actor_user_id"] == "user-1"
    assert isinstance(audit["payload"], dict)
    payload = cast(dict[str, object], audit["payload"])
    assert payload["affects_u_value"] is False
    assert payload["frame_manufacturers_enabled"] == ["Alpen"]
    assert payload["glazing_manufacturers_enabled"] is None
