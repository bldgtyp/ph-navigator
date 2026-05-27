"""Phase 7 Assembly Builder catalog drift and refresh tests."""

from __future__ import annotations

from collections.abc import Iterator

import pytest

from database import transaction
from features.project_document.validation import document_etag
from tests.test_catalogs import _xps_payload
from tests.test_envelope_phase01 import ORIGIN, create_project, envelope_body, signed_in_client, write_saved_body
from tests.test_envelope_phase03 import command_url


@pytest.fixture()
def clean_envelope_drift_tables() -> Iterator[None]:
    _truncate()
    yield
    _truncate()


def _truncate() -> None:
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE catalog_material_versions, catalog_materials,
                     user_action_log, sessions, project_status_items,
                     project_version_drafts, project_versions, projects, users
            RESTART IDENTITY CASCADE
            """
        )


def drift_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/envelope/material-catalog-drift"


def test_material_drift_report_detects_same_version_field_delta_and_overrides(
    clean_envelope_drift_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)
    catalog = client.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_xps_payload()).json()

    picked = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "pick_catalog_material",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_service_cavity",
                "segment_id": "seg_null",
                "catalog_material_id": catalog["id"],
            }
        },
    )
    assert picked.status_code == 200
    copied = next(material for material in picked.json()["project_materials"] if material["name"] == "XPS")

    customized = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": picked.json()["draft_etag"]},
        json={
            "command": {
                "kind": "update_project_material",
                "project_material_id": copied["id"],
                "conductivity_w_mk": 0.031,
            }
        },
    )
    assert customized.status_code == 200

    edited_catalog = client.patch(
        f"/api/v1/catalogs/materials/{catalog['id']}",
        headers={"Origin": ORIGIN},
        json={"density_kg_m3": 41.0},
    )
    assert edited_catalog.status_code == 200
    assert edited_catalog.json()["current_version_id"] == catalog["current_version_id"]

    report = client.get(drift_url(project_id, version_id)).json()
    item = next(row for row in report["materials"] if row["project_material_id"] == copied["id"])
    assert item["state"] == "drifted"
    assert item["pinned_catalog_version_id"] == catalog["current_version_id"]
    assert item["current_catalog_version_id"] == catalog["current_version_id"]
    assert item["local_overrides"] == ["conductivity_w_mk"]
    fields = {field["key"]: field for field in item["fields"]}
    assert fields["conductivity_w_mk"]["is_overridden"] is True
    assert fields["conductivity_w_mk"]["differs"] is True
    assert fields["density_kg_m3"]["differs"] is True


def test_refresh_writes_field_choices_and_preserves_local_overrides(
    clean_envelope_drift_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)
    catalog = client.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_xps_payload()).json()

    picked = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "pick_catalog_material",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_service_cavity",
                "segment_id": "seg_null",
                "catalog_material_id": catalog["id"],
            }
        },
    )
    copied = next(material for material in picked.json()["project_materials"] if material["name"] == "XPS")
    customized = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": picked.json()["draft_etag"]},
        json={
            "command": {
                "kind": "update_project_material",
                "project_material_id": copied["id"],
                "conductivity_w_mk": 0.031,
            }
        },
    )
    client.patch(
        f"/api/v1/catalogs/materials/{catalog['id']}",
        headers={"Origin": ORIGIN},
        json={"density_kg_m3": 41.0, "notes": "Updated catalog note."},
    )

    refreshed = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": customized.json()["draft_etag"]},
        json={
            "command": {
                "kind": "refresh_project_material_from_catalog",
                "project_material_id": copied["id"],
                "field_choices": [
                    {"key": "density_kg_m3", "action": "take_catalog"},
                    {"key": "notes", "action": "use_value", "value": "Reviewed local note."},
                ],
            }
        },
    )

    assert refreshed.status_code == 200
    material = next(row for row in refreshed.json()["project_materials"] if row["id"] == copied["id"])
    assert material["conductivity_w_mk"] == pytest.approx(0.031)
    assert material["density_kg_m3"] == pytest.approx(41.0)
    assert material["notes"] == "Reviewed local note."
    assert material["catalog_origin"]["catalog_version_id"] == catalog["current_version_id"]
    assert material["catalog_origin"]["local_overrides"] == ["conductivity_w_mk"]


def test_drift_report_marks_deactivated_source(
    clean_envelope_drift_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)
    catalog = client.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_xps_payload()).json()
    picked = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "pick_catalog_material",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_service_cavity",
                "segment_id": "seg_null",
                "catalog_material_id": catalog["id"],
            }
        },
    )
    copied = next(material for material in picked.json()["project_materials"] if material["name"] == "XPS")

    deleted = client.delete(f"/api/v1/catalogs/materials/{catalog['id']}", headers={"Origin": ORIGIN})
    assert deleted.status_code == 204

    report = client.get(drift_url(project_id, version_id)).json()
    item = next(row for row in report["materials"] if row["project_material_id"] == copied["id"])
    assert item["state"] == "source_deactivated"

    rejected = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": picked.json()["draft_etag"]},
        json={
            "command": {
                "kind": "refresh_project_material_from_catalog",
                "project_material_id": copied["id"],
                "field_choices": [{"key": "density_kg_m3", "action": "take_catalog"}],
            }
        },
    )
    assert rejected.status_code == 409
    assert rejected.json()["error_code"] == "catalog_material_source_deactivated"
