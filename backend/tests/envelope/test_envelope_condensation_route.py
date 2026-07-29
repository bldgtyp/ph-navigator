"""Condensation service-edge and route contract tests."""

from __future__ import annotations

from collections.abc import Iterator, Mapping

import pytest
from fastapi.testclient import TestClient

from features.climate.record import ClimateRecord
from features.envelope import service as envelope_service
from features.envelope.boundary_conditions import SurfaceFilmTable
from features.envelope.condensation import CondensationResult
from features.envelope.condensation_cache import reset_condensation_cache
from features.envelope.surface_film_store import SurfaceFilmTableUnavailableError
from features.project_climate_source.service import _condensation_source_priority
from features.project_document.document import (
    Assembly,
    CondensationSettings,
    ProjectDocumentV1,
    ProjectMaterial,
)
from features.project_document.validation import document_etag
from tests.envelope.test_envelope_commands_geometry import command_url
from tests.envelope.test_envelope_condensation import _climate
from tests.envelope.test_envelope_document_contracts import (
    ORIGIN,
    create_project,
    project_material,
    signed_in_client,
    write_saved_body,
)
from tests.envelope.test_envelope_thermal_and_export import _thermal_fixture_body


@pytest.fixture()
def clean_condensation_route_tables(clean_document_tables: None) -> Iterator[None]:
    reset_condensation_cache()
    yield
    reset_condensation_cache()


def _url(project_id: object, version_id: object, *, source: str = "version") -> str:
    return (
        f"/api/v1/projects/{project_id}/versions/{version_id}"
        f"/envelope/assemblies/asm_wall_c3/condensation?source={source}"
    )


def _attach_custom_climate(client: TestClient, project_id: object) -> dict[str, object]:
    response = client.post(
        f"/api/v1/projects/{project_id}/climate/sources",
        headers={"Origin": ORIGIN},
        json={
            "kind": "custom",
            "label": "Condensation basis",
            "data": _climate().model_dump(mode="json"),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _body_with_vapor(*, exterior_condition: str = "outdoor_air") -> ProjectDocumentV1:
    raw = _thermal_fixture_body(
        material=project_material(
            id="pmat_insul",
            name="Synthetic insulation",
            conductivity_w_mk=0.04,
            vapor_diffusion_resistance_mu=5.0,
        )
    ).model_dump(mode="json")
    raw["tables"]["assemblies"][0]["exterior_condition"] = exterior_condition
    return ProjectDocumentV1.model_validate(raw)


def test_route_returns_full_screened_payload_with_source_identity(
    clean_condensation_route_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    body = _body_with_vapor()
    write_saved_body(version_id, body)
    climate_source = _attach_custom_climate(client, project_id)

    response = client.get(_url(project_id, version_id), headers={"Origin": ORIGIN})

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == {"state": "screened", "is_complete": True, "flags": []}
    assert payload["source"] == "version"
    assert payload["assembly_id"] == "asm_wall_c3"
    assert payload["climate_source"] == {
        "id": climate_source["id"],
        "kind": "custom",
        "label": "Condensation basis",
    }
    assert len(payload["monthly"]) == 12
    assert len(payload["input_hash"]) == 64


def test_route_reuses_result_for_an_unchanged_input_hash(
    clean_condensation_route_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    write_saved_body(version_id, _body_with_vapor())
    _attach_custom_climate(client, project_id)

    original = envelope_service.calculate_assembly_condensation
    calls = 0

    def counted_calculation(
        assembly: Assembly,
        materials_by_id: Mapping[str, ProjectMaterial],
        climate_record: ClimateRecord | None,
        film_table: SurfaceFilmTable,
        settings: CondensationSettings | None = None,
        *,
        climate_source_identity: Mapping[str, str | None] | None = None,
    ) -> CondensationResult:
        nonlocal calls
        calls += 1
        return original(
            assembly,
            materials_by_id,
            climate_record,
            film_table,
            settings,
            climate_source_identity=climate_source_identity,
        )

    monkeypatch.setattr(envelope_service, "calculate_assembly_condensation", counted_calculation)

    first = client.get(_url(project_id, version_id), headers={"Origin": ORIGIN})
    second = client.get(_url(project_id, version_id), headers={"Origin": ORIGIN})

    assert first.status_code == second.status_code == 200
    assert first.json()["input_hash"] == second.json()["input_hash"]
    assert calls == 1


def test_condensation_climate_priority_respects_project_program_order() -> None:
    assert _condensation_source_priority(["phius"]) == ("custom", "phius", "phi")
    assert _condensation_source_priority(["phi"]) == ("custom", "phi", "phius")
    assert _condensation_source_priority(["phius", "phi"]) == ("custom", "phius", "phi")


def test_missing_climate_and_vapor_are_200_blocked_states(
    clean_condensation_route_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    write_saved_body(version_id, _thermal_fixture_body())

    response = client.get(_url(project_id, version_id), headers={"Origin": ORIGIN})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"]["state"] == "blocked"
    assert set(payload["status"]["flags"]) == {"missing_climate_source", "missing_vapor_data"}
    assert payload["climate_source"] is None


@pytest.mark.parametrize(
    ("exterior_condition", "flag"),
    [
        ("ground", "ground_not_screened"),
        ("unconditioned_space", "unconditioned_space_not_screened"),
    ],
)
def test_out_of_scope_conditions_are_200_not_screened_without_climate(
    clean_condensation_route_tables: None,
    exterior_condition: str,
    flag: str,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    write_saved_body(version_id, _body_with_vapor(exterior_condition=exterior_condition))

    response = client.get(_url(project_id, version_id), headers={"Origin": ORIGIN})

    assert response.status_code == 200
    assert response.json()["status"] == {
        "state": "not_screened",
        "is_complete": False,
        "flags": [flag],
    }


def test_live_draft_material_edit_refreshes_condensation_state(
    clean_condensation_route_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    body = _thermal_fixture_body()
    write_saved_body(version_id, body)
    _attach_custom_climate(client, project_id)
    before = client.get(_url(project_id, version_id, source="draft"), headers={"Origin": ORIGIN})
    assert before.json()["status"]["flags"] == ["missing_vapor_data"]

    edited = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(body)},
        json={
            "command": {
                "kind": "update_project_material",
                "project_material_id": "pmat_insul",
                "vapor_diffusion_resistance_mu": 5.0,
            }
        },
    )
    assert edited.status_code == 200, edited.text

    after = client.get(_url(project_id, version_id, source="draft"), headers={"Origin": ORIGIN})
    assert after.status_code == 200
    assert after.json()["status"] == {"state": "screened", "is_complete": True, "flags": []}
    assert after.json()["input_hash"] != before.json()["input_hash"]


def test_unavailable_surface_film_table_is_typed_409(
    clean_condensation_route_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    write_saved_body(version_id, _body_with_vapor())
    monkeypatch.setattr(
        "features.envelope.service.surface_film_table",
        lambda _standard: (_ for _ in ()).throw(SurfaceFilmTableUnavailableError("missing")),
    )

    response = client.get(_url(project_id, version_id), headers={"Origin": ORIGIN})

    assert response.status_code == 409
    assert response.json()["error_code"] == "surface_film_table_unavailable"
