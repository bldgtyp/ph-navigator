"""Detector tests — walk a document, collect drifted entries."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from features.aperture_drift.detector import detect_aperture_drift
from features.project_document.apertures._ref_helpers import ensure_project_frame, ensure_project_glazing
from features.project_document.document import (
    ApertureElement,
    ApertureElementFrames,
    ApertureTypeEntry,
    CatalogOrigin,
    FrameRef,
    GlazingRef,
    ProjectDocumentTables,
    ProjectDocumentV1,
)
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document


class _StubCatalog:
    def __init__(
        self,
        frame_rows: dict[str, dict[str, Any]] | None = None,
        glazing_rows: dict[str, dict[str, Any]] | None = None,
    ) -> None:
        self._frames = frame_rows or {}
        self._glazings = glazing_rows or {}

    def get_frame_type(self, record_id: str) -> dict[str, Any] | None:
        return self._frames.get(record_id)

    def get_glazing_type(self, record_id: str) -> dict[str, Any] | None:
        return self._glazings.get(record_id)


def _frame_row(**overrides: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "name": "F",
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


def _origin(record_id: str = "rec000000000FRAME") -> CatalogOrigin:
    return CatalogOrigin(
        catalog_table="frame_types",
        catalog_record_id=record_id,
        synced_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


def _frame_ref(**kwargs: Any) -> FrameRef:
    defaults: dict[str, Any] = {
        "name": "F",
        "manufacturer": "ABC",
        "operation": "Fixed",
        "location": "head",
        "width_mm": 80.0,
        "u_value_w_m2k": 1.0,
        "psi_g_w_mk": 0.04,
        "catalog_origin": _origin(),
    }
    defaults.update(kwargs)
    return FrameRef(**defaults)


def _body_with(elements: list[ApertureElement], tables: ProjectDocumentTables) -> ProjectDocumentV1:
    body = empty_project_document(CreateProjectRequest(name="P", bt_number="BT-1", cert_programs=[]))
    aperture = ApertureTypeEntry(
        id="apt_A",
        name="Type A",
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
        elements=elements,
    )
    return body.model_copy(update={"tables": tables.model_copy(update={"apertures": [aperture]})})


def _element(
    tables: ProjectDocumentTables,
    frame: FrameRef | None = None,
    glazing: GlazingRef | None = None,
) -> ApertureElement:
    f = frame if frame is not None else _frame_ref()
    frame_id = ensure_project_frame(tables, f)
    glazing_id = ensure_project_glazing(tables, glazing) if glazing is not None else None
    return ApertureElement(
        id="aptel_A1",
        name="One",
        row_span=(0, 0),
        column_span=(0, 0),
        frames=ApertureElementFrames(top=frame_id, right=frame_id, bottom=frame_id, left=frame_id),
        glazing_id=glazing_id,
    )


def test_no_drift_when_ref_matches_catalog_row() -> None:
    tables = ProjectDocumentTables()
    body = _body_with([_element(tables)], tables)
    catalog = _StubCatalog(frame_rows={"rec000000000FRAME": _frame_row()})
    report = detect_aperture_drift(body, catalog)
    assert report.entries == []


def test_field_delta_surfaces_one_entry_per_drifted_side() -> None:
    tables = ProjectDocumentTables()
    body = _body_with([_element(tables)], tables)
    catalog = _StubCatalog(frame_rows={"rec000000000FRAME": _frame_row(u_value_w_m2k=1.2)})
    report = detect_aperture_drift(body, catalog)
    # Same ref reused on four sides → four entries (one per side).
    assert len(report.entries) == 4
    targets = sorted(e.target for e in report.entries)
    assert targets == ["frame.bottom", "frame.left", "frame.right", "frame.top"]
    assert all(e.kind == "field_delta" for e in report.entries)
    delta = report.entries[0].deltas[0]
    assert delta.field_key == "u_value_w_m2k"


def test_hand_entered_refs_are_skipped() -> None:
    hand = _frame_ref(catalog_origin=None)
    tables = ProjectDocumentTables()
    body = _body_with([_element(tables, frame=hand)], tables)
    catalog = _StubCatalog()
    report = detect_aperture_drift(body, catalog)
    assert report.entries == []


def test_missing_catalog_row_reports_catalog_row_missing() -> None:
    tables = ProjectDocumentTables()
    body = _body_with([_element(tables)], tables)
    catalog = _StubCatalog()  # no rows
    report = detect_aperture_drift(body, catalog)
    assert all(e.kind == "catalog_row_missing" for e in report.entries)
    assert all(e.catalog_record_id == "rec000000000FRAME" for e in report.entries)


def test_glazing_drift_reported_separately() -> None:
    glazing = GlazingRef(
        name="G",
        manufacturer="Alpen",
        u_value_w_m2k=0.8,
        g_value=0.5,
        catalog_origin=CatalogOrigin(
            catalog_table="glazing_types",
            catalog_record_id="recGLZNG000000000",
            synced_at=datetime(2026, 1, 1, tzinfo=UTC),
        ),
    )
    tables = ProjectDocumentTables()
    body = _body_with([_element(tables, glazing=glazing)], tables)
    catalog = _StubCatalog(
        frame_rows={"rec000000000FRAME": _frame_row()},
        glazing_rows={
            "recGLZNG000000000": {
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
        },
    )
    report = detect_aperture_drift(body, catalog)
    glazing_entries = [e for e in report.entries if e.target == "glazing"]
    assert len(glazing_entries) == 1
    assert glazing_entries[0].deltas[0].field_key == "g_value"
