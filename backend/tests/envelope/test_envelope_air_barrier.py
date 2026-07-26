"""Air-barrier designation and its ASTM E2178 check."""

from __future__ import annotations

import pytest

from features.envelope.air_barrier import (
    AIR_BARRIER_MATERIAL_CRITERION_L_S_M2_AT_75PA,
    air_barrier_status,
)
from features.project_document.document import (
    Assembly,
    AssemblyAirBarrier,
    AssemblyLayer,
    AssemblySegment,
    ProjectMaterial,
)
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


def _assembly(permeance: float | None, *, material_id: str = "pmat_wrb") -> tuple[Assembly, dict[str, ProjectMaterial]]:
    material = ProjectMaterial.model_validate(
        project_material(
            id=material_id,
            name="WRB",
            category="membrane",
            conductivity_w_mk=None,
            air_permeance_l_s_m2_at_75pa=permeance,
        )
    )
    assembly = Assembly(
        id="asm_ab",
        name="WALL-AB",
        type="wall",
        orientation="first_layer_outside",
        layers=[
            AssemblyLayer(
                id="lyr_wrb",
                order=0,
                thickness_mm=0.8,
                segments=[AssemblySegment(id="seg_wrb", order=0, width_mm=1000.0, project_material_id=material_id)],
            )
        ],
        air_barrier=AssemblyAirBarrier(layer_id="lyr_wrb", face="exterior"),
    )
    return assembly, {material_id: material}


def test_no_designation_yields_no_status() -> None:
    assembly, materials = _assembly(0.001)
    undesignated = assembly.model_copy(update={"air_barrier": None})

    assert air_barrier_status(undesignated, materials) is None


@pytest.mark.parametrize(
    ("permeance", "expected"),
    [
        (0.001, "pass"),
        (AIR_BARRIER_MATERIAL_CRITERION_L_S_M2_AT_75PA, "pass"),  # the criterion is inclusive
        (0.05, "fail"),
    ],
)
def test_designated_face_is_judged_against_the_e2178_criterion(permeance: float, expected: str) -> None:
    assembly, materials = _assembly(permeance)

    status = air_barrier_status(assembly, materials)

    assert status is not None
    assert status.state == expected
    assert status.air_permeance_l_s_m2_at_75pa == permeance
    assert status.face == "exterior"


def test_unrecorded_permeance_reports_unknown_rather_than_implying_a_pass() -> None:
    """PRD §9 criterion 5a — the whole point of the check."""
    assembly, materials = _assembly(None)

    status = air_barrier_status(assembly, materials)

    assert status is not None
    assert status.state == "unknown"
    assert status.air_permeance_l_s_m2_at_75pa is None


def test_the_leakiest_material_on_the_face_governs() -> None:
    """Air finds the worst path, so a split face is only as tight as its worst segment."""
    assembly, materials = _assembly(0.001)
    leaky = ProjectMaterial.model_validate(
        project_material(id="pmat_leaky", name="Leaky", air_permeance_l_s_m2_at_75pa=0.5)
    )
    layer = assembly.layers[0]
    split = layer.model_copy(
        update={
            "segments": [
                layer.segments[0].model_copy(update={"width_mm": 500.0}),
                AssemblySegment(id="seg_leaky", order=1, width_mm=500.0, project_material_id="pmat_leaky"),
            ]
        }
    )

    status = air_barrier_status(
        assembly.model_copy(update={"layers": [split]}),
        {**materials, "pmat_leaky": leaky},
    )

    assert status is not None
    assert status.state == "fail"
    assert status.air_permeance_l_s_m2_at_75pa == 0.5


def test_a_partly_unrecorded_face_is_unknown_not_a_pass() -> None:
    assembly, materials = _assembly(0.001)
    blank = ProjectMaterial.model_validate(
        project_material(id="pmat_blank", name="Unrecorded", air_permeance_l_s_m2_at_75pa=None)
    )
    layer = assembly.layers[0]
    split = layer.model_copy(
        update={
            "segments": [
                layer.segments[0].model_copy(update={"width_mm": 500.0}),
                AssemblySegment(id="seg_blank", order=1, width_mm=500.0, project_material_id="pmat_blank"),
            ]
        }
    )

    status = air_barrier_status(
        assembly.model_copy(update={"layers": [split]}),
        {**materials, "pmat_blank": blank},
    )

    assert status is not None
    assert status.state == "unknown"


def test_a_designation_pointing_at_a_missing_layer_is_rejected_at_the_document_boundary() -> None:
    """A dangling designation would render nothing and silently mislead."""
    assembly, _ = _assembly(0.001)
    raw = assembly.model_dump(mode="json")
    raw["air_barrier"] = {"layer_id": "lyr_gone", "face": "interior"}

    with pytest.raises(ValueError, match="is not a layer of this assembly"):
        Assembly.model_validate(raw)


def test_set_and_clear_the_designation_through_the_command_surface(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    designated = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "set_assembly_air_barrier",
                "assembly_id": "asm_wall_c3",
                "air_barrier": {"layer_id": "lyr_sheathing", "face": "exterior"},
            }
        },
    )
    assert designated.status_code == 200
    wall = next(asm for asm in designated.json()["assemblies"] if asm["id"] == "asm_wall_c3")
    assert wall["air_barrier"] == {"layer_id": "lyr_sheathing", "face": "exterior"}
    # The seeded material has no recorded permeance, so the face is unproven.
    assert wall["air_barrier_status"]["state"] == "unknown"

    cleared = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": designated.json()["draft_etag"]},
        json={
            "command": {
                "kind": "set_assembly_air_barrier",
                "assembly_id": "asm_wall_c3",
                "air_barrier": None,
            }
        },
    )
    assert cleared.status_code == 200
    cleared_wall = next(asm for asm in cleared.json()["assemblies"] if asm["id"] == "asm_wall_c3")
    assert cleared_wall["air_barrier"] is None
    assert cleared_wall["air_barrier_status"] is None


def test_deleting_the_designated_layer_clears_the_designation(clean_document_tables: None) -> None:
    """Otherwise the document would carry a reference the validator rejects."""
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    designated = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "set_assembly_air_barrier",
                "assembly_id": "asm_wall_c3",
                "air_barrier": {"layer_id": "lyr_sheathing", "face": "interior"},
            }
        },
    )
    assert designated.status_code == 200

    deleted = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": designated.json()["draft_etag"]},
        json={
            "command": {
                "kind": "delete_layer",
                "assembly_id": "asm_wall_c3",
                "layer_id": "lyr_sheathing",
            }
        },
    )

    assert deleted.status_code == 200
    wall = next(asm for asm in deleted.json()["assemblies"] if asm["id"] == "asm_wall_c3")
    assert wall["air_barrier"] is None
