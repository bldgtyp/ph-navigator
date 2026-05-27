"""Assembly Builder thermal preview and HBJSON export tests."""

from __future__ import annotations

from collections.abc import Iterator

import pytest

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


@pytest.fixture()
def clean_envelope_thermal_export_tables() -> Iterator[None]:
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


def test_assembly_thermal_returns_si_values_and_unfinished_flags(
    clean_envelope_thermal_export_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    body = _thermal_fixture_body()
    write_saved_body(version_id, body)

    response = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/envelope/assemblies/asm_wall_c3/thermal?source=version",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == {"is_complete": True, "flags": []}
    assert payload["r_parallel_path_m2k_w"] == pytest.approx(2.5)
    assert payload["r_isothermal_planes_m2k_w"] == pytest.approx(2.5)
    assert payload["r_effective_m2k_w"] == pytest.approx(2.5)
    assert payload["u_effective_w_m2k"] == pytest.approx(0.4)
    assert len(payload["input_hash"]) == 64


def test_thermal_label_can_return_value_for_partial_null_material_layer(
    clean_envelope_thermal_export_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    body = envelope_body()
    write_saved_body(version_id, body)

    response = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/envelope/assemblies/asm_wall_c3/thermal?source=version",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == {"is_complete": False, "flags": ["missing_material"]}
    assert payload["r_effective_m2k_w"] == pytest.approx(1.315789)


def test_hbjson_export_rejects_incomplete_saved_version_with_paths(
    clean_envelope_thermal_export_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    body = envelope_body()
    write_saved_body(version_id, body)

    response = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/envelope/export/hbjson",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 422
    payload = response.json()
    assert payload["error_code"] == "envelope_export_incomplete"
    assert {(error["code"], error["assembly_id"], error["segment_id"]) for error in payload["details"]["errors"]} >= {
        ("missing_material", "asm_wall_c3", "seg_null"),
        ("missing_conductivity", "asm_roof_r1", "seg_roof_insul"),
    }


def test_hbjson_export_uses_saved_version_and_preserves_material_metadata(
    clean_envelope_thermal_export_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    body = _thermal_fixture_body(
        material=project_material(
            id="pmat_insul",
            name="Duplicate Name",
            conductivity_w_mk=0.04,
            specification_status="complete",
            datasheet_asset_ids=["asset_01HXABCDEF0123456789ABCD"],
        )
    )
    write_saved_body(version_id, body)

    draft_response = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(body)},
        json={
            "command": {
                "kind": "update_project_material",
                "project_material_id": "pmat_insul",
                "conductivity_w_mk": 0.08,
            }
        },
    )
    assert draft_response.status_code == 200

    response = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/envelope/export/hbjson",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    payload = response.json()
    construction = payload["constructions"]["WALL_C3"]
    exported_material = construction["materials"][0]
    assert exported_material["conductivity"] == pytest.approx(0.04)
    assert exported_material["properties"]["ref"]["external_identifiers"]["ph_nav"] == "pmat_insul"
    assert exported_material["properties"]["ref"]["ref_status"] == "complete"
    assert exported_material["properties"]["ref"]["document_refs"] == [{"asset_id": "asset_01HXABCDEF0123456789ABCD"}]


def test_hbjson_export_disambiguates_duplicate_material_and_cleaned_assembly_names(
    clean_envelope_thermal_export_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    raw = envelope_body().model_dump(mode="json")
    raw["tables"]["project_materials"] = [
        project_material(id="pmat_a", name="Duplicate Name", conductivity_w_mk=0.04),
        project_material(id="pmat_b", name="Duplicate Name", conductivity_w_mk=0.08),
    ]
    raw["tables"]["assemblies"] = [
        assembly(
            id="asm_wall_a",
            name="WALL/A",
            layers=[
                {
                    "id": "lyr_hybrid",
                    "order": 0,
                    "thickness_mm": 100.0,
                    "segments": [
                        {
                            "id": "seg_a",
                            "order": 0,
                            "width_mm": 500.0,
                            "is_continuous_insulation": False,
                            "steel_stud_spacing_mm": None,
                            "project_material_id": "pmat_a",
                            "photo_asset_ids": [],
                            "use_site_notes": None,
                        },
                        {
                            "id": "seg_b",
                            "order": 1,
                            "width_mm": 500.0,
                            "is_continuous_insulation": False,
                            "steel_stud_spacing_mm": None,
                            "project_material_id": "pmat_b",
                            "photo_asset_ids": [],
                            "use_site_notes": None,
                        },
                    ],
                }
            ],
        ),
        assembly(
            id="asm_wall_b",
            name="WALL A",
            layers=[
                {
                    "id": "lyr_simple",
                    "order": 0,
                    "thickness_mm": 100.0,
                    "segments": [
                        {
                            "id": "seg_simple",
                            "order": 0,
                            "width_mm": 1000.0,
                            "is_continuous_insulation": False,
                            "steel_stud_spacing_mm": None,
                            "project_material_id": "pmat_a",
                            "photo_asset_ids": [],
                            "use_site_notes": None,
                        }
                    ],
                }
            ],
        ),
    ]
    body = ProjectDocumentV1.model_validate(raw)
    write_saved_body(version_id, body)

    response = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/envelope/export/hbjson",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload["constructions"]) == {"WALL_A_asm_wall_a", "WALL_A_asm_wall_b"}
    cells = payload["constructions"]["WALL_A_asm_wall_a"]["materials"][0]["properties"]["ph"]["divisions"]["cells"]
    identifiers = [cell["material"]["identifier"] for cell in cells]
    assert identifiers == ["Duplicate_Name_pmat_a_3_9in", "Duplicate_Name_pmat_b_3_9in"]


def _thermal_fixture_body(*, material: dict[str, object] | None = None) -> ProjectDocumentV1:
    raw = envelope_body().model_dump(mode="json")
    raw["tables"]["project_materials"] = [
        material
        or project_material(
            id="pmat_insul",
            name="Mineral wool",
            conductivity_w_mk=0.04,
            density_kg_m3=40.0,
            specific_heat_j_kgk=840.0,
        )
    ]
    raw["tables"]["assemblies"] = [
        assembly(
            layers=[
                {
                    "id": "lyr_insul",
                    "order": 0,
                    "thickness_mm": 100.0,
                    "segments": [
                        {
                            "id": "seg_insul",
                            "order": 0,
                            "width_mm": 1000.0,
                            "is_continuous_insulation": True,
                            "steel_stud_spacing_mm": None,
                            "project_material_id": "pmat_insul",
                            "photo_asset_ids": [],
                            "use_site_notes": None,
                        }
                    ],
                }
            ]
        )
    ]
    return ProjectDocumentV1.model_validate(raw)
