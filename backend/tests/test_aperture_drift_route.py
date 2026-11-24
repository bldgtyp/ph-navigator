"""Smoke tests for the drift-report REST endpoint.

Heavy detector coverage lives in ``test_aperture_drift_detector.py``
and ``test_aperture_drift_comparator.py``. This file verifies REST
wiring — auth via the shared signed-in client, source-query
validation, and that an empty document returns an empty entries list.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

from database import transaction
from features.aperture_drift.comparator import compare_glazing_ref
from features.aperture_drift.reader import LiveCatalogReader
from features.project_document.aperture_commands.handlers.refresh import apply_refresh_ref_from_catalog
from features.project_document.aperture_commands.models import RefreshRefFromCatalog
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    ApertureElement,
    ApertureTypeEntry,
    CatalogOrigin,
    ProjectGlazing,
)
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def _url(project_id: object, version_id: object, source: str = "draft") -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/apertures/drift-report?source={source}"


def test_empty_apertures_returns_empty_entries(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    response = client.get(
        _url(project["id"], project["active_version_id"], source="draft"),
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"entries": []}


def test_version_source_works_on_fresh_project(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    response = client.get(
        _url(project["id"], project["active_version_id"], source="version"),
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200
    assert response.json() == {"entries": []}


def test_invalid_source_returns_422(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    response = client.get(
        _url(project["id"], project["active_version_id"], source="banana"),
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 422


def test_live_catalog_reader_treats_soft_deactivated_rows_as_missing() -> None:
    frame_ids = ["recDrfFrmLive0001", "recDrfFrmDead0001"]
    glazing_ids = ["recDrfGlzLive0001", "recDrfGlzDead0001"]

    def _cleanup() -> None:
        with transaction() as conn:
            conn.execute("DELETE FROM catalog_frame_types WHERE id = ANY(%(ids)s)", {"ids": frame_ids})
            conn.execute("DELETE FROM catalog_glazing_types WHERE id = ANY(%(ids)s)", {"ids": glazing_ids})

    _cleanup()
    try:
        with transaction() as conn:
            conn.execute(
                """
                INSERT INTO catalog_frame_types (
                    id, name, manufacturer, brand, location, operation, use,
                    width_mm, u_value_w_m2k, psi_g_w_mk, deleted_at
                )
                VALUES
                    ('recDrfFrmLive0001', 'Live Frame', 'Mfg', 'B1', 'Head', 'Fixed', 'Window', 70.0, 1.1, 0.03, NULL),
                    ('recDrfFrmDead0001', 'Dead Frame', 'Mfg', 'B1', 'Head', 'Fixed', 'Window', 70.0, 1.1, 0.03, NOW())
                """
            )
            conn.execute(
                """
                INSERT INTO catalog_glazing_types (
                    id, name, manufacturer, brand, u_value_w_m2k, g_value, deleted_at
                )
                VALUES
                    ('recDrfGlzLive0001', 'Live Glazing', 'Mfg', 'B1', 0.65, 0.42, NULL),
                    ('recDrfGlzDead0001', 'Dead Glazing', 'Mfg', 'B1', 0.65, 0.42, NOW())
                """
            )

        reader = LiveCatalogReader()
        assert reader.get_frame_type("recDrfFrmLive0001") is not None
        assert reader.get_frame_type("recDrfFrmDead0001") is None
        assert reader.get_glazing_type("recDrfGlzLive0001") is not None
        assert reader.get_glazing_type("recDrfGlzDead0001") is None
    finally:
        _cleanup()


def test_refresh_ref_from_catalog_records_override_keys() -> None:
    glazing = ProjectGlazing(
        id="pglz_1",
        name="Triple",
        u_value_w_m2k=0.72,
        g_value=0.50,
        catalog_origin=CatalogOrigin(
            catalog_table="glazing_types",
            catalog_record_id="recGlz00000000001",
            catalog_version_id=None,
            synced_at=datetime(2026, 1, 1, tzinfo=UTC),
            local_overrides=[],
        ),
    )
    base = empty_project_document(CreateProjectRequest(bt_number="2600", name="Drift Test"))
    body = base.model_copy(
        update={
            "tables": base.tables.model_copy(
                update={
                    "project_glazings": [glazing],
                    "apertures": [
                        ApertureTypeEntry(
                            id="apt_1",
                            name="W-01",
                            row_heights_mm=[1500.0],
                            column_widths_mm=[1000.0],
                            elements=[
                                ApertureElement(
                                    id="aptel_1",
                                    name="Center",
                                    row_span=(0, 0),
                                    column_span=(0, 0),
                                    glazing_id="pglz_1",
                                )
                            ],
                        )
                    ],
                }
            )
        }
    )
    cmd = RefreshRefFromCatalog(
        aperture_type_id="apt_1",
        element_id="aptel_1",
        target="glazing",
        chosen_values={"u_value_w_m2k": 0.72},
        override_keys=["u_value_w_m2k"],
    )
    next_body, _ = apply_refresh_ref_from_catalog(body, cmd, "usr_1", cast(DefaultsCatalogReader, None))
    updated = next_body.tables.project_glazings[0]
    assert updated.catalog_origin is not None
    assert updated.catalog_origin.local_overrides == ["u_value_w_m2k"]
    deltas = compare_glazing_ref(updated, {"u_value_w_m2k": 0.65, "g_value": 0.50})
    assert len(deltas) == 1
    assert deltas[0].in_local_overrides is True
