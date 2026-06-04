"""Assembly Builder geometry command tests."""

from __future__ import annotations

from features.project_document.document import ProjectDocumentV1
from features.project_document.validation import document_etag
from tests.envelope.test_envelope_document_contracts import (
    ORIGIN,
    create_project,
    envelope_body,
    signed_in_client,
    write_saved_body,
)


def command_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/envelope/commands"


def two_segment_envelope_body() -> ProjectDocumentV1:
    body = envelope_body()
    raw = body.model_dump(mode="json")
    raw["tables"]["assemblies"][0]["layers"][0]["segments"].append(
        {
            "id": "seg_sheathing_extra",
            "order": 1,
            "width_mm": 406.4,
            "is_continuous_insulation": False,
            "steel_stud_spacing_mm": None,
            "project_material_id": None,
            "photo_asset_ids": [],
            "use_site_notes": None,
        }
    )
    raw["tables"]["assemblies"][0]["layers"][1]["segments"].append(
        {
            "id": "seg_service_extra",
            "order": 1,
            "width_mm": 406.4,
            "is_continuous_insulation": False,
            "steel_stud_spacing_mm": None,
            "project_material_id": "pmat_insul",
            "photo_asset_ids": [],
            "use_site_notes": None,
        }
    )
    return type(body).model_validate(raw)


def test_envelope_command_creates_draft_and_edits_geometry(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    created = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "create_assembly",
                "name": "FLOOR-F1",
                "type": "floor",
                "thickness_mm": 150,
                "width_mm": 1200,
            }
        },
    )

    assert created.status_code == 200
    created_json = created.json()
    assert created_json["source"] == "draft"
    new_assembly = created_json["assemblies"][-1]
    assert new_assembly["name"] == "FLOOR-F1"
    assert new_assembly["layers"][0]["segments"][0]["width_mm"] == 1200

    updated = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": created_json["draft_etag"]},
        json={
            "command": {
                "kind": "update_layer_thickness",
                "assembly_id": new_assembly["id"],
                "layer_id": new_assembly["layers"][0]["id"],
                "thickness_mm": 175,
            }
        },
    )
    assert updated.status_code == 200
    assert updated.json()["assemblies"][-1]["layers"][0]["thickness_mm"] == 175


def test_envelope_command_rejects_stale_and_locked_versions(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    stale = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": "stale"},
        json={"command": {"kind": "rename_assembly", "assembly_id": "asm_wall_c3", "name": "WALL-X"}},
    )
    assert stale.status_code == 409
    assert stale.json()["error_code"] == "version_etag_mismatch"

    locked = client.patch(
        f"/api/v1/projects/{project_id}/versions/{version_id}",
        headers={"Origin": ORIGIN},
        json={"locked": True},
    )
    assert locked.status_code == 200

    rejected = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={"command": {"kind": "rename_assembly", "assembly_id": "asm_wall_c3", "name": "WALL-X"}},
    )
    assert rejected.status_code == 409
    assert rejected.json()["error_code"] == "version_locked"


def test_envelope_command_guards_and_copy_paste_scope(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    duplicate = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={"command": {"kind": "duplicate_assembly", "assembly_id": "asm_wall_c3"}},
    )
    assert duplicate.status_code == 200
    duplicated = duplicate.json()["assemblies"][-1]
    assert duplicated["name"] == "WALL-C3 Copy"
    assert duplicated["layers"][0]["segments"][0]["project_material_id"] == "pmat_insul"
    assert duplicated["layers"][0]["segments"][0]["photo_asset_ids"] == []
    assert duplicated["layers"][0]["segments"][0]["use_site_notes"] is None

    last_layer = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": duplicate.json()["draft_etag"]},
        json={
            "command": {
                "kind": "delete_layer",
                "assembly_id": duplicated["id"],
                "layer_id": duplicated["layers"][0]["id"],
            }
        },
    )
    assert last_layer.status_code == 200
    remaining_layer = last_layer.json()["assemblies"][-1]["layers"][0]
    guard = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": last_layer.json()["draft_etag"]},
        json={
            "command": {
                "kind": "delete_layer",
                "assembly_id": duplicated["id"],
                "layer_id": remaining_layer["id"],
            }
        },
    )
    assert guard.status_code == 409
    assert guard.json()["error_code"] == "last_layer"

    pasted = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": last_layer.json()["draft_etag"]},
        json={
            "command": {
                "kind": "paste_assignment",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_service_cavity",
                "segment_id": "seg_null",
                "project_material_id": "pmat_insul",
                "is_continuous_insulation": True,
                "steel_stud_spacing_mm": 609.6,
            }
        },
    )
    assert pasted.status_code == 200
    segment = pasted.json()["assemblies"][0]["layers"][1]["segments"][0]
    assert segment["project_material_id"] == "pmat_insul"
    assert segment["width_mm"] == 812.8
    assert segment["use_site_notes"] is None
    assert segment["photo_asset_ids"] == []


def test_envelope_command_flips_segments_in_every_layer(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = two_segment_envelope_body()
    write_saved_body(version_id, saved_body)

    flipped = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={"command": {"kind": "flip_segments", "assembly_id": "asm_wall_c3"}},
    )

    assert flipped.status_code == 200
    layers = flipped.json()["assemblies"][0]["layers"]
    assert [layer["id"] for layer in layers] == ["lyr_sheathing", "lyr_service_cavity"]
    assert [segment["id"] for segment in layers[0]["segments"]] == ["seg_sheathing_extra", "seg_insul"]
    assert [segment["id"] for segment in layers[1]["segments"]] == ["seg_service_extra", "seg_null"]
    assert [segment["order"] for segment in layers[0]["segments"]] == [0, 1]
    assert [segment["order"] for segment in layers[1]["segments"]] == [0, 1]
