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


def test_rename_assembly_rejects_duplicate_name(clean_document_tables: None) -> None:
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
    duplicated_id = duplicate.json()["assemblies"][-1]["id"]
    draft_etag = duplicate.json()["draft_etag"]

    # Exact-name collision against the original assembly.
    rejected = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": draft_etag},
        json={"command": {"kind": "rename_assembly", "assembly_id": duplicated_id, "name": "WALL-C3"}},
    )
    assert rejected.status_code == 409
    assert rejected.json()["error_code"] == "duplicate_assembly_name"

    # Case-fold + surrounding-whitespace collision.
    rejected_case = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": draft_etag},
        json={"command": {"kind": "rename_assembly", "assembly_id": duplicated_id, "name": "  wall-c3  "}},
    )
    assert rejected_case.status_code == 409
    assert rejected_case.json()["error_code"] == "duplicate_assembly_name"


def test_update_assembly_type_roundtrips(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    response = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={"command": {"kind": "update_assembly_type", "assembly_id": "asm_wall_c3", "type": "floor"}},
    )
    assert response.status_code == 200
    target = next(asm for asm in response.json()["assemblies"] if asm["id"] == "asm_wall_c3")
    assert target["type"] == "floor"


def test_delete_assembly_removes_row_and_rejects_unknown_id(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    deleted = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={"command": {"kind": "delete_assembly", "assembly_id": "asm_wall_c3"}},
    )
    assert deleted.status_code == 200
    assert {asm["id"] for asm in deleted.json()["assemblies"]} == {"asm_roof_r1"}

    missing = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": deleted.json()["draft_etag"]},
        json={"command": {"kind": "delete_assembly", "assembly_id": "asm_does_not_exist"}},
    )
    assert missing.status_code == 409
    assert missing.json()["error_code"] == "assembly_not_found"


def test_flip_orientation_is_a_toggle(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    flipped = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={"command": {"kind": "flip_orientation", "assembly_id": "asm_wall_c3"}},
    )
    assert flipped.status_code == 200
    assert flipped.json()["assemblies"][0]["orientation"] == "last_layer_outside"

    twice = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": flipped.json()["draft_etag"]},
        json={"command": {"kind": "flip_orientation", "assembly_id": "asm_wall_c3"}},
    )
    assert twice.status_code == 200
    assert twice.json()["assemblies"][0]["orientation"] == "first_layer_outside"


def test_flip_layers_reverses_order_and_preserves_segment_ids(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    response = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={"command": {"kind": "flip_layers", "assembly_id": "asm_wall_c3"}},
    )
    assert response.status_code == 200
    layers = next(asm for asm in response.json()["assemblies"] if asm["id"] == "asm_wall_c3")["layers"]
    assert [layer["id"] for layer in layers] == ["lyr_service_cavity", "lyr_sheathing"]
    assert [layer["order"] for layer in layers] == [0, 1]
    assert layers[0]["segments"][0]["id"] == "seg_null"
    assert layers[1]["segments"][0]["id"] == "seg_insul"


def test_add_layer_above_and_below_target(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    above = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "add_layer",
                "assembly_id": "asm_wall_c3",
                "target_layer_id": "lyr_sheathing",
                "position": "above",
                "thickness_mm": 25.0,
            }
        },
    )
    assert above.status_code == 200
    layers_above = next(asm for asm in above.json()["assemblies"] if asm["id"] == "asm_wall_c3")["layers"]
    assert layers_above[0]["thickness_mm"] == 25.0
    assert [layer["id"] for layer in layers_above[1:]] == ["lyr_sheathing", "lyr_service_cavity"]

    below = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": above.json()["draft_etag"]},
        json={
            "command": {
                "kind": "add_layer",
                "assembly_id": "asm_wall_c3",
                "target_layer_id": "lyr_sheathing",
                "position": "below",
                "thickness_mm": 30.0,
            }
        },
    )
    assert below.status_code == 200
    layers_below = next(asm for asm in below.json()["assemblies"] if asm["id"] == "asm_wall_c3")["layers"]
    sheathing_index = next(i for i, layer in enumerate(layers_below) if layer["id"] == "lyr_sheathing")
    assert layers_below[sheathing_index + 1]["thickness_mm"] == 30.0


def test_add_segment_left_and_right_of_target(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    right = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "add_segment",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_sheathing",
                "target_segment_id": "seg_insul",
                "position": "right",
                "width_mm": 200.0,
            }
        },
    )
    assert right.status_code == 200
    sheathing_after_right = next(
        layer
        for layer in next(asm for asm in right.json()["assemblies"] if asm["id"] == "asm_wall_c3")["layers"]
        if layer["id"] == "lyr_sheathing"
    )
    assert sheathing_after_right["segments"][0]["id"] == "seg_insul"
    assert sheathing_after_right["segments"][1]["width_mm"] == 200.0
    assert [seg["order"] for seg in sheathing_after_right["segments"]] == [0, 1]

    left = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": right.json()["draft_etag"]},
        json={
            "command": {
                "kind": "add_segment",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_sheathing",
                "target_segment_id": "seg_insul",
                "position": "left",
                "width_mm": 150.0,
            }
        },
    )
    assert left.status_code == 200
    sheathing_after_left = next(
        layer
        for layer in next(asm for asm in left.json()["assemblies"] if asm["id"] == "asm_wall_c3")["layers"]
        if layer["id"] == "lyr_sheathing"
    )
    assert sheathing_after_left["segments"][0]["width_mm"] == 150.0
    assert sheathing_after_left["segments"][1]["id"] == "seg_insul"


def test_update_segment_changes_only_addressed_fields(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    response = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "update_segment",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_sheathing",
                "segment_id": "seg_insul",
                "width_mm": 600.0,
                "is_continuous_insulation": True,
                "steel_stud_spacing_mm": None,
            }
        },
    )
    assert response.status_code == 200
    segment = next(
        seg
        for asm in response.json()["assemblies"]
        if asm["id"] == "asm_wall_c3"
        for layer in asm["layers"]
        if layer["id"] == "lyr_sheathing"
        for seg in layer["segments"]
        if seg["id"] == "seg_insul"
    )
    assert segment["width_mm"] == 600.0
    assert segment["is_continuous_insulation"] is True
    # Untouched persisted fields survive the partial-edit command.
    assert segment["project_material_id"] == "pmat_insul"
    assert segment["use_site_notes"] == "Use over exterior sheathing."


def test_delete_segment_happy_path_and_last_segment_guard(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = two_segment_envelope_body()
    write_saved_body(version_id, saved_body)

    deleted = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "delete_segment",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_sheathing",
                "segment_id": "seg_sheathing_extra",
            }
        },
    )
    assert deleted.status_code == 200
    sheathing = next(
        layer
        for asm in deleted.json()["assemblies"]
        if asm["id"] == "asm_wall_c3"
        for layer in asm["layers"]
        if layer["id"] == "lyr_sheathing"
    )
    assert [seg["id"] for seg in sheathing["segments"]] == ["seg_insul"]

    last = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": deleted.json()["draft_etag"]},
        json={
            "command": {
                "kind": "delete_segment",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_sheathing",
                "segment_id": "seg_insul",
            }
        },
    )
    assert last.status_code == 409
    assert last.json()["error_code"] == "last_segment"


def test_paste_assignment_noop_short_circuits_without_creating_draft(clean_document_tables: None) -> None:
    """Paste matching the saved version's segment values returns 200 with no draft created."""
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    noop = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "paste_assignment",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_sheathing",
                "segment_id": "seg_insul",
                "project_material_id": "pmat_insul",
                "is_continuous_insulation": False,
                "steel_stud_spacing_mm": None,
            }
        },
    )
    assert noop.status_code == 200
    payload = noop.json()
    assert payload["source"] == "version"
    assert payload["draft_etag"] is None


def test_rename_assembly_to_own_name_succeeds(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    response = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={"command": {"kind": "rename_assembly", "assembly_id": "asm_wall_c3", "name": "WALL-C3"}},
    )
    assert response.status_code == 200
    assert response.json()["assemblies"][0]["name"] == "WALL-C3"
