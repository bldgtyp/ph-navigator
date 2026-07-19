"""Assembly Builder material command tests."""

from __future__ import annotations

from collections.abc import Iterator

import pytest

from database import transaction
from features.project_document.validation import document_etag
from tests.envelope.test_envelope_commands_geometry import command_url
from tests.envelope.test_envelope_document_contracts import (
    ORIGIN,
    create_project,
    envelope_body,
    project_material,
    signed_in_client,
    write_saved_body,
)
from tests.test_catalogs import _xps_payload


@pytest.fixture()
def clean_envelope_material_tables() -> Iterator[None]:
    _truncate()
    yield
    _truncate()


def _truncate() -> None:
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE catalog_materials,
                     user_action_log, sessions, project_status_items,
                     project_version_drafts, project_versions, project_location, projects, users
            RESTART IDENTITY CASCADE
            """
        )


def test_catalog_pick_copies_once_and_reuses_project_material(
    clean_envelope_material_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)
    catalog = client.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_xps_payload()).json()

    first = client.post(
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
    assert first.status_code == 200
    first_json = first.json()
    copied = next(material for material in first_json["project_materials"] if material["name"] == "XPS")
    assert copied["catalog_origin"]["catalog_record_id"] == catalog["id"]
    assert copied["catalog_origin"]["catalog_version_id"] is None
    assert copied["specification_status"] == "missing"
    assert first_json["assemblies"][0]["layers"][1]["segments"][0]["project_material_id"] == copied["id"]

    second = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": first_json["draft_etag"]},
        json={
            "command": {
                "kind": "pick_catalog_material",
                "assembly_id": "asm_roof_r1",
                "layer_id": "lyr_roof_insul",
                "segment_id": "seg_roof_insul",
                "catalog_material_id": catalog["id"],
            }
        },
    )
    assert second.status_code == 200
    second_json = second.json()
    copied_again = [
        material
        for material in second_json["project_materials"]
        if material["catalog_origin"] and material["catalog_origin"]["catalog_record_id"] == catalog["id"]
    ]
    assert len(copied_again) == 1
    assert second_json["assemblies"][1]["layers"][0]["segments"][0]["project_material_id"] == copied["id"]
    assert len(copied_again[0]["use_sites"]) == 2


def test_material_edit_use_site_notes_detach_and_unused_cleanup(
    clean_envelope_material_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    hand_entered = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "hand_enter_material",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_service_cavity",
                "segment_id": "seg_null",
                "name": "Custom cork",
            }
        },
    )
    assert hand_entered.status_code == 200
    hand_json = hand_entered.json()
    custom = next(material for material in hand_json["project_materials"] if material["name"] == "Custom cork")
    assert custom["category"] == "Other"
    assert custom["conductivity_w_mk"] is None
    assert custom["catalog_origin"] is None

    edited = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": hand_json["draft_etag"]},
        json={
            "command": {
                "kind": "update_project_material",
                "project_material_id": custom["id"],
                "conductivity_w_mk": 0.041,
                "density_kg_m3": 115.0,
                "specific_heat_j_kgk": 1800.0,
                "specification_status": "needed",
                "comments": "Confirm final product submittal.",
            }
        },
    )
    assert edited.status_code == 200
    edited_material = next(
        material for material in edited.json()["project_materials"] if material["id"] == custom["id"]
    )
    assert edited_material["conductivity_w_mk"] == pytest.approx(0.041)
    assert edited_material["specification_status"] == "missing"

    noted = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": edited.json()["draft_etag"]},
        json={
            "command": {
                "kind": "update_segment_use_site_notes",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_service_cavity",
                "segment_id": "seg_null",
                "use_site_notes": "Use only at service cavity returns.",
            }
        },
    )
    assert noted.status_code == 200
    segment = noted.json()["assemblies"][0]["layers"][1]["segments"][0]
    assert segment["use_site_notes"] == "Use only at service cavity returns."
    noted_material = next(material for material in noted.json()["project_materials"] if material["id"] == custom["id"])
    assert noted_material["comments"] == "Confirm final product submittal."

    detached = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": noted.json()["draft_etag"]},
        json={
            "command": {
                "kind": "detach_segment_material",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_service_cavity",
                "segment_id": "seg_null",
            }
        },
    )
    assert detached.status_code == 200
    detached_segment = detached.json()["assemblies"][0]["layers"][1]["segments"][0]
    detached_material = next(
        material
        for material in detached.json()["project_materials"]
        if material["id"] == detached_segment["project_material_id"]
    )
    assert detached_material["name"] == "Custom cork (Custom)"
    assert detached_material["catalog_origin"] is None
    assert detached_material["comments"] == "Confirm final product submittal."
    assert detached_segment["use_site_notes"] == "Use only at service cavity returns."

    cleaned = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": detached.json()["draft_etag"]},
        json={"command": {"kind": "remove_unused_project_materials"}},
    )
    assert cleaned.status_code == 200
    remaining_ids = {material["id"] for material in cleaned.json()["project_materials"]}
    assert custom["id"] not in remaining_ids
    assert detached_material["id"] in remaining_ids


def test_remove_project_material_deletes_only_unused_materials(
    clean_envelope_material_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    raw = saved_body.model_dump(mode="json")
    raw["tables"]["project_materials"].append(
        project_material(id="pmat_unused", name="Unused air barrier", datasheet_asset_ids=[])
    )
    saved_body = saved_body.__class__.model_validate(raw)
    write_saved_body(version_id, saved_body)

    used = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={"command": {"kind": "remove_project_material", "project_material_id": "pmat_insul"}},
    )
    assert used.status_code == 409
    assert used.json()["error_code"] == "project_material_in_use"

    unused = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={"command": {"kind": "remove_project_material", "project_material_id": "pmat_unused"}},
    )
    assert unused.status_code == 200
    remaining_ids = {material["id"] for material in unused.json()["project_materials"]}
    assert "pmat_unused" not in remaining_ids
    assert "pmat_insul" in remaining_ids

    missing = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": unused.json()["draft_etag"]},
        json={"command": {"kind": "remove_project_material", "project_material_id": "pmat_does_not_exist"}},
    )
    assert missing.status_code == 409
    assert missing.json()["error_code"] == "project_material_not_found"


def test_pick_project_material_assigns_existing_material_and_rejects_unknown(
    clean_envelope_material_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    picked = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "pick_project_material",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_service_cavity",
                "segment_id": "seg_null",
                "project_material_id": "pmat_insul",
            }
        },
    )
    assert picked.status_code == 200
    segment = picked.json()["assemblies"][0]["layers"][1]["segments"][0]
    assert segment["project_material_id"] == "pmat_insul"

    missing = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": picked.json()["draft_etag"]},
        json={
            "command": {
                "kind": "pick_project_material",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_service_cavity",
                "segment_id": "seg_null",
                "project_material_id": "pmat_does_not_exist",
            }
        },
    )
    assert missing.status_code == 409
    assert missing.json()["error_code"] == "project_material_not_found"
