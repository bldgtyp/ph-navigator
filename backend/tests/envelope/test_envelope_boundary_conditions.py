"""Assembly boundary-condition field, ISO 6946 resolver, and command tests."""

from __future__ import annotations

from typing import get_args

import pytest

from features.envelope.boundary_conditions import (
    ISO_13788_SURFACE_CHECK_RSI,
    SurfaceFilmTable,
    heat_flow_direction,
    resolve_surface_resistances,
)
from features.envelope.surface_film_store import reset_surface_film_cache
from features.envelope.thermal import calculate_assembly_thermal, thermal_input_hash
from features.project_document.document import (
    Assembly,
    AssemblyLayer,
    AssemblySegment,
    AssemblyType,
    ExteriorCondition,
    ProjectAssumptions,
    ProjectDocumentTables,
    ProjectDocumentV1,
    ProjectMaterial,
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


def _one_layer_assembly(**overrides: object) -> tuple[Assembly, dict[str, ProjectMaterial]]:
    """A 100 mm / λ 0.04 slab → exactly R 2.5 construction-only."""
    materials = {"pmat_a": ProjectMaterial(id="pmat_a", name="Insul", category="generic", conductivity_w_mk=0.04)}
    base: dict[str, object] = {
        "id": "asm_a",
        "name": "A",
        "type": "wall",
        "orientation": "first_layer_outside",
        "layers": [
            AssemblyLayer(
                id="lyr_a",
                order=0,
                thickness_mm=100.0,
                segments=[AssemblySegment(id="seg_a", order=0, width_mm=1000.0, project_material_id="pmat_a")],
            )
        ],
    }
    base.update(overrides)
    return Assembly.model_validate(base), materials


def test_films_are_added_in_series_with_the_construction() -> None:
    assembly, materials = _one_layer_assembly()

    result = calculate_assembly_thermal(assembly, materials)

    assert result.r_construction_m2k_w == pytest.approx(2.5)
    assert result.u_construction_w_m2k == pytest.approx(0.4)
    # Wall + outdoor air → 0.13 + 2.5 + 0.04
    assert result.r_effective_m2k_w == pytest.approx(2.67)
    assert result.u_effective_w_m2k == pytest.approx(1.0 / 2.67)


@pytest.mark.parametrize(
    ("assembly_type", "exterior_condition", "expected_r_total"),
    [
        ("wall", "outdoor_air", 2.5 + 0.13 + 0.04),
        ("roof", "outdoor_air", 2.5 + 0.10 + 0.04),
        ("floor", "outdoor_air", 2.5 + 0.17 + 0.04),
        ("floor", "ground", 2.5 + 0.17 + 0.0),
        ("wall", "ventilated", 2.5 + 0.13 + 0.13),
        ("wall", "unconditioned_space", 2.5 + 0.13 + 0.13),
    ],
)
def test_effective_r_tracks_both_boundary_axes(
    assembly_type: AssemblyType,
    exterior_condition: ExteriorCondition,
    expected_r_total: float,
) -> None:
    assembly, materials = _one_layer_assembly(type=assembly_type, exterior_condition=exterior_condition)

    result = calculate_assembly_thermal(assembly, materials)

    assert result.r_effective_m2k_w == pytest.approx(expected_r_total)
    # The construction never moves — only the films do.
    assert result.r_construction_m2k_w == pytest.approx(2.5)


def test_films_are_reported_even_when_the_calculation_is_blocked() -> None:
    """Rsi/Rse depend only on type + exterior condition, so they are always known."""
    assembly, _ = _one_layer_assembly(type="floor", exterior_condition="ground")

    result = calculate_assembly_thermal(assembly, {})

    assert result.r_effective_m2k_w is None
    assert result.status.is_complete is False
    assert (result.rsi_m2k_w, result.rse_m2k_w) == (0.17, 0.0)
    assert result.heat_flow_direction == "downward"
    assert result.thermal_standard == "iso_6946"


def test_input_hash_changes_with_every_surface_film_input() -> None:
    """All three film inputs must invalidate a cached preview."""
    assembly, materials = _one_layer_assembly()
    baseline = thermal_input_hash(assembly, materials, "iso_6946")

    assert thermal_input_hash(assembly, materials, "iso_6946") == baseline
    # The standard is not part of the assembly subtree, so it is hashed
    # explicitly — without that, switching standards would serve stale
    # cached previews.
    assert thermal_input_hash(assembly, materials, "ashrae") != baseline
    ventilated = assembly.model_copy(update={"exterior_condition": "ventilated"})
    assert thermal_input_hash(ventilated, materials, "iso_6946") != baseline
    roof = assembly.model_copy(update={"type": "roof"})
    assert thermal_input_hash(roof, materials, "iso_6946") != baseline


def test_thermal_route_exposes_films_and_both_conventions(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)
    assembly_id = saved_body.tables.assemblies[0].id

    response = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/envelope/assemblies/{assembly_id}/thermal?source=version",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["rsi_m2k_w"] == 0.13
    assert payload["rse_m2k_w"] == 0.04
    assert payload["heat_flow_direction"] == "horizontal"
    assert payload["thermal_standard"] == "iso_6946"
    assert payload["r_effective_m2k_w"] == pytest.approx(payload["r_construction_m2k_w"] + 0.17)


def test_thermal_route_409s_when_the_licensed_table_is_unpublished(
    clean_document_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An operator-fixable gap, not a crash.

    A document can name ASHRAE on a deployment whose private store has no
    ASHRAE table. That must be a typed, actionable 409 — never a 500, and
    never ISO numbers reported under an ASHRAE label.
    """
    monkeypatch.setattr("features.envelope.surface_film_store.settings.r2_endpoint_url", "")
    reset_surface_film_cache()
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    raw = envelope_body().model_dump(mode="json")
    raw["tables"]["assumptions"] = {"thermal_standard": "ashrae"}
    saved_body = ProjectDocumentV1.model_validate(raw)
    write_saved_body(version_id, saved_body)
    assembly_id = saved_body.tables.assemblies[0].id

    response = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/envelope/assemblies/{assembly_id}/thermal?source=version",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 409
    assert response.json()["error_code"] == "surface_film_table_unavailable"


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


def _publish_ashrae(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make the licensed table resolvable, without a real object store."""
    reset_surface_film_cache()
    monkeypatch.setattr("features.envelope.surface_film_store.settings.r2_endpoint_url", "http://minio.test")
    monkeypatch.setattr(
        "features.envelope.surface_film_store.SurfaceFilmStore.from_settings",
        classmethod(lambda cls: _StubFilmStore()),
    )


class _StubFilmStore:
    def get(self, standard: str) -> SurfaceFilmTable | None:
        if standard != "ashrae":
            return None
        # Synthetic, not ASHRAE's published values — this repo is public.
        return SurfaceFilmTable(
            standard="ashrae",
            rsi_by_direction={"upward": 0.25, "horizontal": 0.35, "downward": 0.45},
            rse_outdoor_air_m2k_w=0.05,
        )

    def loaded_version(self, standard: str) -> str | None:
        del standard
        return None


def test_set_thermal_standard_switches_the_project_convention(
    clean_document_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _publish_ashrae(monkeypatch)
    client = signed_in_client()
    project = create_project(client)
    saved_body = envelope_body()
    write_saved_body(project["active_version_id"], saved_body)

    response = client.post(
        command_url(project["id"], project["active_version_id"]),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={"command": {"kind": "set_thermal_standard", "thermal_standard": "ashrae"}},
    )

    assert response.status_code == 200
    thermal = client.get(
        f"/api/v1/projects/{project['id']}/versions/{project['active_version_id']}"
        f"/envelope/assemblies/{saved_body.tables.assemblies[0].id}/thermal"
    )
    assert thermal.status_code == 200
    # The switch has to reach the numbers, not just the stored field.
    assert thermal.json()["thermal_standard"] == "ashrae"
    assert thermal.json()["rse_m2k_w"] == 0.05


def test_set_thermal_standard_rejects_a_standard_with_no_published_table(
    clean_document_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Rejected at the write, so the document never names an uncomputable convention."""
    reset_surface_film_cache()
    monkeypatch.setattr("features.envelope.surface_film_store.settings.r2_endpoint_url", "")
    client = signed_in_client()
    project = create_project(client)
    saved_body = envelope_body()
    write_saved_body(project["active_version_id"], saved_body)

    response = client.post(
        command_url(project["id"], project["active_version_id"]),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={"command": {"kind": "set_thermal_standard", "thermal_standard": "ashrae"}},
    )

    assert response.status_code == 409
    assert response.json()["error_code"] == "surface_film_table_unavailable"


def test_thermal_standards_endpoint_reports_what_this_deployment_can_use(
    clean_document_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reset_surface_film_cache()
    monkeypatch.setattr("features.envelope.surface_film_store.settings.r2_endpoint_url", "")
    client = signed_in_client()
    project = create_project(client)
    write_saved_body(project["active_version_id"], envelope_body())

    response = client.get(
        f"/api/v1/projects/{project['id']}/versions/{project['active_version_id']}/envelope/thermal-standards"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["active"] == "iso_6946"
    available = {option["thermal_standard"]: option["available"] for option in payload["options"]}
    # ISO ships in code; the licensed set is unusable until an operator seeds it.
    assert available == {"iso_6946": True, "ashrae": False}


def test_thermal_standards_endpoint_marks_a_seeded_standard_available(
    clean_document_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _publish_ashrae(monkeypatch)
    client = signed_in_client()
    project = create_project(client)
    write_saved_body(project["active_version_id"], envelope_body())

    response = client.get(
        f"/api/v1/projects/{project['id']}/versions/{project['active_version_id']}/envelope/thermal-standards"
    )

    assert response.status_code == 200
    available = {option["thermal_standard"]: option["available"] for option in response.json()["options"]}
    assert available == {"iso_6946": True, "ashrae": True}
