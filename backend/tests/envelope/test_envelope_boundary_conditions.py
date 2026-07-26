"""Assembly boundary-condition field, ISO 6946 resolver, and command tests."""

from __future__ import annotations

from typing import get_args

import pytest

from features.envelope.boundary_conditions import (
    ISO_13788_SURFACE_CHECK_RSI,
    heat_flow_direction,
    resolve_surface_resistances,
)
from features.project_document.document import (
    AssemblyType,
    ExteriorCondition,
    ProjectAssumptions,
    ProjectDocumentTables,
    ProjectDocumentV1,
)
from features.project_document.validation import document_etag
from tests.envelope.test_envelope_commands_geometry import command_url
from tests.envelope.test_envelope_document_contracts import (
    ORIGIN,
    create_project,
    envelope_body,
    signed_in_client,
    write_saved_body,
)

#: ISO 6946 Table 1, transcribed independently of the implementation so the
#: test fails if either the table or the type→direction mapping drifts.
_EXPECTED_RSI: dict[AssemblyType, float] = {
    "roof": 0.10,
    "wall": 0.13,
    "floor": 0.17,
    "other": 0.13,
}
_EXPECTED_DIRECTION: dict[AssemblyType, str] = {
    "roof": "upward",
    "wall": "horizontal",
    "floor": "downward",
    "other": "horizontal",
}


@pytest.mark.parametrize("assembly_type", get_args(AssemblyType))
@pytest.mark.parametrize("exterior_condition", get_args(ExteriorCondition))
def test_iso_6946_resolves_every_type_and_exterior_condition(
    assembly_type: AssemblyType,
    exterior_condition: ExteriorCondition,
) -> None:
    """Every ``(type, exterior_condition)`` pair resolves a deterministic triple."""
    resolved = resolve_surface_resistances(assembly_type, exterior_condition)

    assert resolved.rsi_m2k_w == _EXPECTED_RSI[assembly_type]
    assert resolved.heat_flow_direction == _EXPECTED_DIRECTION[assembly_type]
    assert resolved.standard == "iso_6946"
    if exterior_condition == "outdoor_air":
        assert resolved.rse_m2k_w == 0.04
    elif exterior_condition == "ground":
        assert resolved.rse_m2k_w == 0.0
    else:
        # ISO 6946 §6: a well-ventilated exterior face is treated as internal.
        assert resolved.rse_m2k_w == resolved.rsi_m2k_w


def test_unconditioned_space_and_ventilated_are_film_identical_but_distinct_values() -> None:
    """Same Rse today; kept as separate values because the meanings differ."""
    ventilated = resolve_surface_resistances("wall", "ventilated")
    unconditioned = resolve_surface_resistances("wall", "unconditioned_space")

    assert ventilated.rse_m2k_w == unconditioned.rse_m2k_w
    assert "unconditioned_space" in get_args(ExteriorCondition)


def test_total_film_r_sums_both_faces() -> None:
    resolved = resolve_surface_resistances("wall", "outdoor_air")
    assert resolved.total_film_r_m2k_w == pytest.approx(0.17)


def test_heat_flow_direction_is_derived_from_assembly_type_alone() -> None:
    assert heat_flow_direction("roof") == "upward"
    assert heat_flow_direction("floor") == "downward"


def test_iso_13788_surface_check_rsi_is_separate_from_the_u_value_films() -> None:
    """The mould/surface-condensation Rsi must never be one of the U-value films."""
    assert ISO_13788_SURFACE_CHECK_RSI == 0.25
    for assembly_type in get_args(AssemblyType):
        assert resolve_surface_resistances(assembly_type, "outdoor_air").rsi_m2k_w != ISO_13788_SURFACE_CHECK_RSI


def test_existing_assemblies_default_to_outdoor_air() -> None:
    """A document written before the field existed reads back as outdoor-air facing."""
    body = envelope_body()
    assert [assembly.exterior_condition for assembly in body.tables.assemblies] == ["outdoor_air"] * len(
        body.tables.assemblies
    )


def test_absent_assumptions_block_resolves_to_iso_6946() -> None:
    tables = ProjectDocumentTables()
    assert tables.assumptions is None
    assert tables.resolved_assumptions() == ProjectAssumptions()
    assert tables.resolved_assumptions().thermal_standard == "iso_6946"


def test_assumptions_block_round_trips_through_the_document(clean_document_tables: None) -> None:
    raw = envelope_body().model_dump(mode="json")
    raw["tables"]["assumptions"] = {"thermal_standard": "iso_6946"}
    body = ProjectDocumentV1.model_validate(raw)

    assert body.tables.assumptions is not None
    assert body.tables.resolved_assumptions().thermal_standard == "iso_6946"


def test_update_assembly_exterior_condition_command(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)
    assembly_id = saved_body.tables.assemblies[0].id

    response = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "update_assembly_exterior_condition",
                "assembly_id": assembly_id,
                "exterior_condition": "ground",
            }
        },
    )

    assert response.status_code == 200
    updated = next(item for item in response.json()["assemblies"] if item["id"] == assembly_id)
    assert updated["exterior_condition"] == "ground"


def test_update_assembly_exterior_condition_rejects_an_unknown_value(clean_document_tables: None) -> None:
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
                "kind": "update_assembly_exterior_condition",
                "assembly_id": saved_body.tables.assemblies[0].id,
                "exterior_condition": "outer_space",
            }
        },
    )

    assert response.status_code == 422
