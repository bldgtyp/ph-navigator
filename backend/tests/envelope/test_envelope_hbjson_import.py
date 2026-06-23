"""HBJSON construction import — preview + apply (native files)."""

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from database import transaction
from features.project_document.document import ProjectDocumentV1
from features.project_document.validation import document_etag
from tests.envelope.test_envelope_commands_geometry import command_url
from tests.envelope.test_envelope_document_contracts import (
    ORIGIN,
    assembly,
    create_project,
    envelope_body,
    project_material,
    signed_in_client,
    write_saved_body,
)
from tests.test_catalogs import _xps_payload


@pytest.fixture()
def clean_import_tables() -> Iterator[None]:
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


# --- flow helpers ---------------------------------------------------------


def _preview_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/envelope/import/hbjson/preview"


def _export(client: TestClient, project_id: object, version_id: object) -> dict[str, Any]:
    response = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/envelope/export/hbjson",
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _preview(client: TestClient, project_id: object, version_id: object, payload: object) -> Any:
    return client.post(
        _preview_url(project_id, version_id),
        files={"file": ("constructions.hbjson", json.dumps(payload), "application/json")},
        headers={"Origin": ORIGIN},
    )


def _apply(
    client: TestClient,
    project_id: object,
    version_id: object,
    payload: object,
    *,
    version_etag: str | None = None,
    draft_etag: str | None = None,
    resolutions: list[dict[str, Any]] | None = None,
) -> Any:
    headers = {"Origin": ORIGIN}
    if draft_etag is not None:
        headers["If-Match"] = draft_etag
    elif version_etag is not None:
        headers["If-Match-Version"] = version_etag
    return client.post(
        command_url(project_id, version_id),
        headers=headers,
        json={
            "command": {
                "kind": "import_envelope_constructions",
                "file": payload,
                "resolutions": resolutions or [],
            }
        },
    )


def _apply_from_preview(
    client: TestClient,
    project_id: object,
    version_id: object,
    payload: object,
    preview_json: dict[str, Any],
    resolutions: list[dict[str, Any]] | None = None,
) -> Any:
    return _apply(
        client,
        project_id,
        version_id,
        payload,
        version_etag=preview_json["version_etag"],
        draft_etag=preview_json["draft_etag"],
        resolutions=resolutions,
    )


# --- fixture bodies -------------------------------------------------------


def _body(materials: list[dict[str, Any]], assemblies: list[dict[str, Any]]) -> ProjectDocumentV1:
    raw = envelope_body().model_dump(mode="json")
    raw["tables"]["project_materials"] = materials
    raw["tables"]["assemblies"] = assemblies
    return ProjectDocumentV1.model_validate(raw)


def _homogeneous_assembly(**overrides: Any) -> dict[str, Any]:
    base = assembly(
        id="asm_wall_c3",
        name="WALL-C3",
        layers=[
            {
                "id": "lyr_insul",
                "order": 0,
                "thickness_mm": 100.0,
                "segments": [
                    {
                        "id": "seg_insul",
                        "order": 0,
                        # 1000 mm == DEFAULT_LAYER_WIDTH_MM so a homogeneous layer round-trips exactly.
                        "width_mm": 1000.0,
                        "is_continuous_insulation": True,
                        "steel_stud_spacing_mm": None,
                        "project_material_id": "pmat_insul",
                        "photo_asset_ids": [],
                        "use_site_notes": None,
                    }
                ],
            }
        ],
    )
    base.update(overrides)
    return base


def _complete_insulation() -> dict[str, Any]:
    return project_material(
        id="pmat_insul",
        name="Mineral wool",
        conductivity_w_mk=0.04,
        specification_status="complete",
        datasheet_asset_ids=[],
    )


def _empty_project(client: TestClient) -> tuple[str, str]:
    # A second project in the same test needs a distinct bt_number (the shared
    # `create_project` helper hardcodes one, which collides).
    response = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json={
            "name": "Import Target",
            "bt_number": "9001",
            "client": "May",
            "cert_programs": ["phi"],
            "phius_number": None,
            "phius_dropbox_url": None,
        },
    )
    assert response.status_code == 201, response.text
    project = response.json()
    return project["id"], project["active_version_id"]


# --- round-trip (rung 1: reuse) -------------------------------------------


def test_native_round_trip_replaces_and_reuses_materials(clean_import_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id, version_id = project["id"], project["active_version_id"]
    body = _body([_complete_insulation()], [_homogeneous_assembly()])
    write_saved_body(version_id, body)

    payload = _export(client, project_id, version_id)
    preview = _preview(client, project_id, version_id, payload)
    assert preview.status_code == 200, preview.text
    preview_json = preview.json()

    assert preview_json["counts"] == {
        "constructions_add": 0,
        "constructions_replace": 1,
        "constructions_skip": 0,
        "materials_reused": 1,
        "materials_picked_from_catalog": 0,
        "materials_created": 0,
    }
    assert preview_json["constructions"][0]["action"] == "replace"
    assert preview_json["constructions"][0]["target_assembly_id"] == "asm_wall_c3"
    assert preview_json["materials"][0]["decision"] == "reuse_project_material"
    assert preview_json["materials"][0]["project_material_id"] == "pmat_insul"

    applied = _apply_from_preview(client, project_id, version_id, payload, preview_json)
    assert applied.status_code == 200, applied.text
    applied_json = applied.json()
    # Reuse path mints no new materials, and the assembly round-trips its identity.
    assert [material["id"] for material in applied_json["project_materials"]] == ["pmat_insul"]
    restored = applied_json["assemblies"][0]
    assert restored["id"] == "asm_wall_c3"
    assert restored["type"] == "wall"
    assert restored["orientation"] == "first_layer_outside"
    segment = restored["layers"][0]["segments"][0]
    assert segment["project_material_id"] == "pmat_insul"
    assert segment["is_continuous_insulation"] is True


def test_preview_does_not_create_a_draft(clean_import_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id, version_id = project["id"], project["active_version_id"]
    write_saved_body(version_id, _body([_complete_insulation()], [_homogeneous_assembly()]))

    payload = _export(client, project_id, version_id)
    preview = _preview(client, project_id, version_id, payload).json()
    assert preview["source"] == "version"
    assert preview["draft_etag"] is None

    read = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/envelope",
        headers={"Origin": ORIGIN},
    ).json()
    assert read["source"] == "version"
    assert read["draft_etag"] is None


# --- hybrid + orientation round-trips -------------------------------------


def test_hybrid_layer_round_trips_widths_and_segment_materials(clean_import_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id, version_id = project["id"], project["active_version_id"]
    materials = [
        project_material(id="pmat_cavity", name="Cavity", conductivity_w_mk=0.04, datasheet_asset_ids=[]),
        project_material(id="pmat_stud", name="Stud", conductivity_w_mk=50.0, datasheet_asset_ids=[]),
    ]
    hybrid = assembly(
        id="asm_hybrid",
        name="WALL-HYBRID",
        layers=[
            {
                "id": "lyr_hybrid",
                "order": 0,
                "thickness_mm": 140.0,
                "segments": [
                    {
                        "id": "seg_cavity",
                        "order": 0,
                        "width_mm": 850.0,
                        "is_continuous_insulation": True,
                        "steel_stud_spacing_mm": None,
                        "project_material_id": "pmat_cavity",
                        "photo_asset_ids": [],
                        "use_site_notes": None,
                    },
                    {
                        "id": "seg_stud",
                        "order": 1,
                        "width_mm": 150.0,
                        "is_continuous_insulation": False,
                        "steel_stud_spacing_mm": 406.4,
                        "project_material_id": "pmat_stud",
                        "photo_asset_ids": [],
                        "use_site_notes": None,
                    },
                ],
            }
        ],
    )
    write_saved_body(version_id, _body(materials, [hybrid]))

    payload = _export(client, project_id, version_id)
    preview = _preview(client, project_id, version_id, payload).json()
    applied = _apply_from_preview(client, project_id, version_id, payload, preview).json()

    layer = applied["assemblies"][0]["layers"][0]
    assert layer["thickness_mm"] == pytest.approx(140.0)
    segments = layer["segments"]
    assert [segment["width_mm"] for segment in segments] == pytest.approx([850.0, 150.0])
    assert [segment["project_material_id"] for segment in segments] == ["pmat_cavity", "pmat_stud"]
    assert segments[0]["is_continuous_insulation"] is True
    assert segments[1]["steel_stud_spacing_mm"] == pytest.approx(406.4)


def test_last_layer_outside_orientation_round_trips(clean_import_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id, version_id = project["id"], project["active_version_id"]
    materials = [
        project_material(id="pmat_a", name="MatA", conductivity_w_mk=0.04, datasheet_asset_ids=[]),
        project_material(id="pmat_b", name="MatB", conductivity_w_mk=0.06, datasheet_asset_ids=[]),
    ]
    reversed_assembly = assembly(
        id="asm_rev",
        name="WALL-REV",
        orientation="last_layer_outside",
        layers=[
            {
                "id": "lyr_a",
                "order": 0,
                "thickness_mm": 50.0,
                "segments": [_single_segment("seg_a", "pmat_a")],
            },
            {
                "id": "lyr_b",
                "order": 1,
                "thickness_mm": 60.0,
                "segments": [_single_segment("seg_b", "pmat_b")],
            },
        ],
    )
    write_saved_body(version_id, _body(materials, [reversed_assembly]))

    payload = _export(client, project_id, version_id)
    preview = _preview(client, project_id, version_id, payload).json()
    applied = _apply_from_preview(client, project_id, version_id, payload, preview).json()

    restored = applied["assemblies"][0]
    assert restored["orientation"] == "last_layer_outside"
    # Document order (layer 0 first) is restored, not the outside-in export order.
    assert [layer["segments"][0]["project_material_id"] for layer in restored["layers"]] == ["pmat_a", "pmat_b"]


def _single_segment(segment_id: str, material_id: str) -> dict[str, Any]:
    return {
        "id": segment_id,
        "order": 0,
        "width_mm": 1000.0,
        "is_continuous_insulation": False,
        "steel_stud_spacing_mm": None,
        "project_material_id": material_id,
        "photo_asset_ids": [],
        "use_site_notes": None,
    }


# --- cross-project: pick-from-catalog (rung 3) + create-new (rung 6) -------


def test_cross_project_picks_from_catalog_when_record_resolves(clean_import_tables: None) -> None:
    client = signed_in_client()
    catalog = client.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_xps_payload()).json()

    source_project = create_project(client)
    source_version = source_project["active_version_id"]
    catalog_material = project_material(
        id="pmat_src",
        name="XPS (source copy)",
        conductivity_w_mk=0.03,
        datasheet_asset_ids=[],
        catalog_origin={
            "catalog_table": "materials",
            "catalog_record_id": catalog["id"],
            "synced_at": "2026-01-01T00:00:00Z",
            "local_overrides": [],
        },
    )
    write_saved_body(
        source_version,
        _body([catalog_material], [_homogeneous_assembly(layers=_layers_for("pmat_src"))]),
    )
    payload = _export(client, source_project["id"], source_version)

    target_id, target_version = _empty_project(client)
    preview = _preview(client, target_id, target_version, payload).json()
    material_plan = preview["materials"][0]
    assert material_plan["decision"] == "pick_from_catalog"
    assert material_plan["catalog_record_id"] == catalog["id"]
    assert preview["constructions"][0]["action"] == "add_new"

    applied = _apply_from_preview(client, target_id, target_version, payload, preview).json()
    picked = applied["project_materials"]
    assert len(picked) == 1
    assert picked[0]["id"] != "pmat_src"  # a fresh copy, not the foreign source id
    assert picked[0]["catalog_origin"]["catalog_record_id"] == catalog["id"]
    # D3: snapshot the live catalog values, not the file's drifted copy.
    assert picked[0]["name"] == "XPS"


def test_cross_project_creates_project_only_material_when_unmatched(clean_import_tables: None) -> None:
    client = signed_in_client()
    source_project = create_project(client)
    source_version = source_project["active_version_id"]
    foreign = project_material(
        id="pmat_foreign",
        name="Foreign board",
        conductivity_w_mk=0.05,
        datasheet_asset_ids=[],
        catalog_origin=None,
    )
    write_saved_body(
        source_version,
        _body([foreign], [_homogeneous_assembly(layers=_layers_for("pmat_foreign"))]),
    )
    payload = _export(client, source_project["id"], source_version)

    target_id, target_version = _empty_project(client)
    preview = _preview(client, target_id, target_version, payload).json()
    assert preview["materials"][0]["decision"] == "create_new"

    applied = _apply_from_preview(client, target_id, target_version, payload, preview).json()
    created = applied["project_materials"][0]
    assert created["catalog_origin"] is None
    assert created["category"] == "Other"  # not exported; defaulted
    assert created["conductivity_w_mk"] == pytest.approx(0.05)
    assert applied["assemblies"][0]["layers"][0]["segments"][0]["project_material_id"] == created["id"]


def _layers_for(material_id: str) -> list[dict[str, Any]]:
    return [
        {
            "id": "lyr_insul",
            "order": 0,
            "thickness_mm": 100.0,
            "segments": [_single_segment("seg_insul", material_id)],
        }
    ]


# --- per-construction resolutions -----------------------------------------


def test_skip_resolution_drops_the_construction(clean_import_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id, version_id = project["id"], project["active_version_id"]
    write_saved_body(version_id, _body([_complete_insulation()], [_homogeneous_assembly()]))
    payload = _export(client, project_id, version_id)

    preview = _preview(client, project_id, version_id, payload).json()
    applied = _apply_from_preview(
        client,
        project_id,
        version_id,
        payload,
        preview,
        resolutions=[{"source_assembly_id": "asm_wall_c3", "action": "skip"}],
    )
    # Skipping the only construction leaves the body unchanged → no draft churn.
    assert applied.status_code == 200, applied.text
    assert applied.json()["assemblies"][0]["id"] == "asm_wall_c3"


def test_add_new_resolution_keeps_existing_and_appends_suffixed_copy(clean_import_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id, version_id = project["id"], project["active_version_id"]
    write_saved_body(version_id, _body([_complete_insulation()], [_homogeneous_assembly()]))
    payload = _export(client, project_id, version_id)

    preview = _preview(client, project_id, version_id, payload).json()
    applied = _apply_from_preview(
        client,
        project_id,
        version_id,
        payload,
        preview,
        resolutions=[{"source_assembly_id": "asm_wall_c3", "action": "add_new"}],
    ).json()

    assemblies = applied["assemblies"]
    assert len(assemblies) == 2
    names = sorted(item["name"] for item in assemblies)
    assert names == ["WALL-C3", "WALL-C3 2"]


# --- rejections -----------------------------------------------------------


def test_preview_rejects_wrong_file_type(clean_import_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id, version_id = project["id"], project["active_version_id"]
    write_saved_body(version_id, _body([_complete_insulation()], [_homogeneous_assembly()]))

    preview = _preview(client, project_id, version_id, {"type": "SomethingElse", "schema_version": 1})
    assert preview.status_code == 422
    assert preview.json()["error_code"] == "import_wrong_file_type"


def test_preview_rejects_invalid_json(clean_import_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id, version_id = project["id"], project["active_version_id"]
    write_saved_body(version_id, _body([_complete_insulation()], [_homogeneous_assembly()]))

    preview = client.post(
        _preview_url(project_id, version_id),
        files={"file": ("bad.hbjson", b"{not json", "application/json")},
        headers={"Origin": ORIGIN},
    )
    assert preview.status_code == 422
    assert preview.json()["error_code"] == "import_invalid_json"


def test_preview_rejects_schema_newer_than_app(clean_import_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id, version_id = project["id"], project["active_version_id"]
    body = _body([_complete_insulation()], [_homogeneous_assembly()])
    write_saved_body(version_id, body)
    payload = _export(client, project_id, version_id)
    payload["schema_version"] = body.schema_version + 1

    preview = _preview(client, project_id, version_id, payload)
    assert preview.status_code == 422
    assert preview.json()["error_code"] == "import_schema_too_new"


def test_preview_rejects_multi_row_divisions(clean_import_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id, version_id = project["id"], project["active_version_id"]
    write_saved_body(version_id, _body([_complete_insulation()], [_homogeneous_assembly()]))
    payload = _export(client, project_id, version_id)
    # Forge a multi-row division grid the importer must reject (rejected before
    # any cell is read, so the cell material is a throwaway placeholder).
    cell_material = {"type": "EnergyMaterial", "identifier": "cell", "thickness": 0.1, "conductivity": 0.04}
    material = payload["constructions"]["WALL_C3"]["materials"][0]
    material["properties"]["ph"]["divisions"] = {
        "row_heights": [0.5, 0.5],
        "column_widths": [1.0],
        "cells": [
            {"column_width": 1.0, "row_height": 0.5, "material": cell_material, "ph_nav": {"segment_id": "seg_x"}}
        ],
    }

    preview = _preview(client, project_id, version_id, payload)
    assert preview.status_code == 422
    assert preview.json()["error_code"] == "import_unsupported_divisions"


def test_apply_command_validates_etag(clean_import_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id, version_id = project["id"], project["active_version_id"]
    body = _body([_complete_insulation()], [_homogeneous_assembly()])
    write_saved_body(version_id, body)
    payload = _export(client, project_id, version_id)

    stale = _apply(client, project_id, version_id, payload, version_etag="sha256:deadbeef")
    assert stale.status_code == 409
    assert stale.json()["error_code"] == "version_etag_mismatch"
    # The matching etag applies cleanly.
    ok = _apply(client, project_id, version_id, payload, version_etag=document_etag(body))
    assert ok.status_code == 200, ok.text
