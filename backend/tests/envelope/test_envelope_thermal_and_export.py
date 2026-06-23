"""Assembly Builder thermal preview and HBJSON export tests."""

from __future__ import annotations

from collections.abc import Iterator

import pytest

from database import transaction
from features.envelope.thermal import (
    calculate_assembly_thermal,
    thermal_input_hash,
    thermal_issue_flags,
    thermal_issues,
)
from features.project_document.document import (
    Assembly,
    AssemblyLayer,
    AssemblySegment,
    ProjectDocumentV1,
    ProjectMaterial,
)
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
            TRUNCATE catalog_materials,
                     user_action_log, sessions, project_status_items,
                     project_version_drafts, project_versions, project_location, projects, users
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


def _multi_segment_assembly() -> tuple[Assembly, dict[str, ProjectMaterial]]:
    """Two-layer assembly that exercises both ASHRAE methods.

    Layer 1 (outer): single segment, mineral wool, 100 mm at lambda=0.04.
    Layer 2 (inner): hybrid, 140 mm thick.
      - Seg A: 850 mm wide, lambda=0.04 (cavity insulation).
      - Seg B: 150 mm wide, lambda=0.13 (wood-like, deliberately not steel).
    Total width 1000 mm.

    Hand calc (ASHRAE Ch. 25):
      R_L1            = 0.100 / 0.04            = 2.5
      R_seg_A (L2)    = 0.140 / 0.04            = 3.5
      R_seg_B (L2)    = 0.140 / 0.13            = 1.07692
      Parallel-Path total_u = 0.85/6.0 + 0.15/3.57692 = 0.18360
                        R_parallel_path        = 1 / 0.18360 = 5.4466
      Isothermal-Planes layer-2 sum_u_frac
                        = 0.85/3.5 + 0.15/1.07692 = 0.38214
                        R_layer2_isoplane      = 1 / 0.38214 = 2.6168
                        R_isothermal_planes    = 2.5 + 2.6168 = 5.1168
      R_effective     = (5.4466 + 5.1168) / 2  = 5.2817
    """
    materials = {
        "pmat_insul": ProjectMaterial.model_validate(
            project_material(id="pmat_insul", name="Mineral wool", conductivity_w_mk=0.04)
        ),
        "pmat_wood": ProjectMaterial.model_validate(
            project_material(id="pmat_wood", name="Softwood stud", conductivity_w_mk=0.13)
        ),
    }
    asm = Assembly(
        id="asm_multi",
        name="WALL-MULTI",
        type="wall",
        orientation="first_layer_outside",
        layers=[
            AssemblyLayer(
                id="lyr_outer",
                order=0,
                thickness_mm=100.0,
                segments=[AssemblySegment(id="seg_outer", order=0, width_mm=1000.0, project_material_id="pmat_insul")],
            ),
            AssemblyLayer(
                id="lyr_inner",
                order=1,
                thickness_mm=140.0,
                segments=[
                    AssemblySegment(id="seg_cavity", order=0, width_mm=850.0, project_material_id="pmat_insul"),
                    AssemblySegment(id="seg_stud", order=1, width_mm=150.0, project_material_id="pmat_wood"),
                ],
            ),
        ],
    )
    return asm, materials


def test_thermal_multi_segment_exercises_both_ashrae_methods() -> None:
    asm, materials = _multi_segment_assembly()

    result = calculate_assembly_thermal(asm, materials)

    assert result.status.is_complete is True
    r_parallel = result.r_parallel_path_m2k_w
    r_isothermal = result.r_isothermal_planes_m2k_w
    r_effective = result.r_effective_m2k_w
    u_effective = result.u_effective_w_m2k
    assert r_parallel is not None and r_isothermal is not None and r_effective is not None and u_effective is not None
    assert r_parallel == pytest.approx(5.4466, rel=5e-3)
    assert r_isothermal == pytest.approx(5.1168, rel=5e-3)
    assert r_effective == pytest.approx((r_parallel + r_isothermal) / 2.0, rel=1e-6)
    assert u_effective == pytest.approx(1.0 / r_effective, rel=1e-4)


def test_thermal_input_hash_covers_physics_only() -> None:
    """Hash covers physically relevant fields so UI caching keys to thermal identity, not display identity."""
    asm, materials = _multi_segment_assembly()
    baseline = thermal_input_hash(asm, materials)

    assert thermal_input_hash(asm, materials) == baseline

    bumped_conductivity = {
        **materials,
        "pmat_wood": materials["pmat_wood"].model_copy(update={"conductivity_w_mk": 0.14}),
    }
    assert thermal_input_hash(asm, bumped_conductivity) != baseline

    bumped_thickness = asm.model_copy(
        update={
            "layers": [
                asm.layers[0].model_copy(update={"thickness_mm": 110.0}),
                asm.layers[1],
            ]
        }
    )
    assert thermal_input_hash(bumped_thickness, materials) != baseline

    renamed = {
        **materials,
        "pmat_wood": materials["pmat_wood"].model_copy(update={"name": "Renamed wood"}),
    }
    assert thermal_input_hash(asm, renamed) == baseline


def test_thermal_issues_flag_invalid_geometry_for_zero_width_segment() -> None:
    asm, materials = _multi_segment_assembly()
    bad_segment = asm.layers[1].segments[1].model_copy(update={"width_mm": 0.0})
    bad_layer = asm.layers[1].model_copy(update={"segments": [asm.layers[1].segments[0], bad_segment]})
    bad_asm = asm.model_copy(update={"layers": [asm.layers[0], bad_layer]})

    flags = thermal_issue_flags(thermal_issues(bad_asm, materials))
    assert "invalid_geometry" in flags


def test_thermal_issues_flag_invalid_geometry_for_zero_thickness_layer() -> None:
    asm, materials = _multi_segment_assembly()
    bad_layer = asm.layers[0].model_copy(update={"thickness_mm": 0.0})
    bad_asm = asm.model_copy(update={"layers": [bad_layer, asm.layers[1]]})

    flags = thermal_issue_flags(thermal_issues(bad_asm, materials))
    assert "invalid_geometry" in flags


def test_thermal_issues_flag_broken_material_reference() -> None:
    """The document validator rejects orphan project_material_id at save time, so this branch
    is defensive — exercise it via a direct call rather than the route."""
    asm, materials = _multi_segment_assembly()
    materials_missing_wood = {"pmat_insul": materials["pmat_insul"]}

    flags = thermal_issue_flags(thermal_issues(asm, materials_missing_wood))
    assert "broken_material_reference" in flags


def test_hbjson_export_reverses_layers_when_last_layer_outside(
    clean_envelope_thermal_export_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    raw = envelope_body().model_dump(mode="json")
    raw["tables"]["project_materials"] = [
        project_material(id="pmat_a", name="MatA", conductivity_w_mk=0.04),
        project_material(id="pmat_b", name="MatB", conductivity_w_mk=0.06),
        project_material(id="pmat_c", name="MatC", conductivity_w_mk=0.08),
    ]
    raw["tables"]["assemblies"] = [
        assembly(
            id="asm_reverse",
            name="WALL-REV",
            orientation="last_layer_outside",
            layers=[
                {
                    "id": "lyr_a",
                    "order": 0,
                    "thickness_mm": 50.0,
                    "segments": [
                        {
                            "id": "seg_a",
                            "order": 0,
                            "width_mm": 1000.0,
                            "is_continuous_insulation": False,
                            "steel_stud_spacing_mm": None,
                            "project_material_id": "pmat_a",
                            "photo_asset_ids": [],
                            "use_site_notes": None,
                        }
                    ],
                },
                {
                    "id": "lyr_b",
                    "order": 1,
                    "thickness_mm": 60.0,
                    "segments": [
                        {
                            "id": "seg_b",
                            "order": 0,
                            "width_mm": 1000.0,
                            "is_continuous_insulation": False,
                            "steel_stud_spacing_mm": None,
                            "project_material_id": "pmat_b",
                            "photo_asset_ids": [],
                            "use_site_notes": None,
                        }
                    ],
                },
                {
                    "id": "lyr_c",
                    "order": 2,
                    "thickness_mm": 70.0,
                    "segments": [
                        {
                            "id": "seg_c",
                            "order": 0,
                            "width_mm": 1000.0,
                            "is_continuous_insulation": False,
                            "steel_stud_spacing_mm": None,
                            "project_material_id": "pmat_c",
                            "photo_asset_ids": [],
                            "use_site_notes": None,
                        }
                    ],
                },
            ],
        )
    ]
    body = ProjectDocumentV1.model_validate(raw)
    write_saved_body(version_id, body)

    response = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/envelope/export/hbjson",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    construction = response.json()["constructions"]["WALL_REV"]
    material_names = [material["display_name"] for material in construction["materials"]]
    assert material_names == ["MatC", "MatB", "MatA"]


def test_hbjson_export_emits_homogeneous_round_trip_ph_nav(
    clean_envelope_thermal_export_tables: None,
) -> None:
    """PRD §4: the export carries the assembly/layer/segment identity that the
    Honeybee shape cannot express, so a future import re-creates it losslessly."""
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    write_saved_body(version_id, _thermal_fixture_body())

    response = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/envelope/export/hbjson",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    construction = response.json()["constructions"]["WALL_C3"]
    assert construction["ph_nav"] == {
        "assembly_id": "asm_wall_c3",
        "assembly_type": "wall",
        "orientation": "first_layer_outside",
    }
    layer_material = construction["materials"][0]
    assert layer_material["ph_nav"]["layer_id"] == "lyr_insul"
    assert layer_material["ph_nav"]["segment_id"] == "seg_insul"
    assert layer_material["ph_nav"]["is_continuous_insulation"] is True


def test_hbjson_export_emits_hybrid_layer_round_trip_ph_nav(
    clean_envelope_thermal_export_tables: None,
) -> None:
    """A hybrid layer's parent material carries `layer_id`; each cell carries its
    own `segment_id` + `is_continuous_insulation` for per-segment reconstruction."""
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    raw = envelope_body().model_dump(mode="json")
    raw["tables"]["project_materials"] = [
        project_material(id="pmat_cavity", name="Cavity insulation", conductivity_w_mk=0.04),
        project_material(id="pmat_stud", name="Steel stud", conductivity_w_mk=50.0),
    ]
    raw["tables"]["assemblies"] = [
        assembly(
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
    ]
    write_saved_body(version_id, ProjectDocumentV1.model_validate(raw))

    response = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/envelope/export/hbjson",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    hybrid_material = response.json()["constructions"]["WALL_HYBRID"]["materials"][0]
    assert hybrid_material["ph_nav"]["layer_id"] == "lyr_hybrid"
    cells = hybrid_material["properties"]["ph"]["divisions"]["cells"]
    assert [cell["ph_nav"] for cell in cells] == [
        {"segment_id": "seg_cavity", "is_continuous_insulation": True},
        {"segment_id": "seg_stud", "is_continuous_insulation": False},
    ]


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
