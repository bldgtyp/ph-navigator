"""Model Viewer Phase 2: pure-extraction contract tests (US-VIEW-7).

Golden counts come from the two canonical fixtures (PLAN.md Phase 2
coverage map, corrected against the actual parsed models — see
STATUS.md). Paths neither fixture covers (AirBoundary skip, Adiabatic,
recirc piping, m³/s airflow values) are synthesized by mutating the
parsed primary model in-place.

No DB / no HTTP here — `extraction.py` is dict-in/DTOs-out by design.
The artifact + job workflow is covered in `test_model_viewer_model_data.py`.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

import pytest
from honeybee.facetype import face_types
from honeybee.model import Model

# Adiabatic's real home — honeybee_energy injects it into
# honeybee.boundarycondition at import time, invisible to static analysis.
from honeybee_energy.boundarycondition import Adiabatic
from honeybee_phhvac import hot_water_piping as hwp
from ladybug_geometry.geometry3d.line import LineSegment3D
from ladybug_geometry.geometry3d.pointvector import Point3D

from features.model_viewer.extraction import (
    ModelParseError,
    extract_geometry_summary,
    extract_model_data,
    parse_hb_model,
)
from features.model_viewer.schemas.combined import CombinedModelDataSchema

FIXTURES = Path(__file__).parent / "fixtures"
PRIMARY_FIXTURE = FIXTURES / "ph_nav_v2_example.hbjson"
HILLANDALE_FIXTURE = FIXTURES / "Hillandale_Gateway_NAR_260402.hbjson"


def _load_primary_model() -> Model:
    return parse_hb_model(json.loads(PRIMARY_FIXTURE.read_text()))


@pytest.fixture(scope="module")
def primary_data() -> CombinedModelDataSchema:
    """Extract the canonical fixture once for all read-only assertions."""
    return extract_model_data(_load_primary_model())


# ----------------------- primary fixture goldens ---------------------------


def test_primary_face_golden_counts(primary_data: CombinedModelDataSchema) -> None:
    assert primary_data.load_summary.faces_extracted == 25
    assert primary_data.load_summary.air_boundaries_skipped == 0
    assert primary_data.load_summary.extraction_warnings == []
    assert Counter(f.face_type for f in primary_data.faces) == {"Wall": 16, "Floor": 5, "RoofCeiling": 4}
    assert Counter(f.boundary_condition.type for f in primary_data.faces) == {
        "Outdoors": 12,
        "Ground": 7,
        "Surface": 6,
    }
    assert sum(len(f.apertures) for f in primary_data.faces) == 30
    # Every face ships a punched, triangulated mesh + area.
    for face in primary_data.faces:
        assert face.geometry.mesh is not None
        assert face.geometry.mesh.faces
        assert all(len(tri) == 3 for tri in face.geometry.mesh.faces)
        assert face.geometry.area is not None and face.geometry.area > 0


def test_primary_constructions_carry_all_four_thermal_fields(primary_data: CombinedModelDataSchema) -> None:
    """D-12: Factor (films included) AND Value (films excluded), opaque + window."""
    face = primary_data.faces[0]
    construction = face.properties.energy.construction
    assert construction is not None
    assert construction.u_factor > 0
    assert construction.u_value > construction.u_factor  # removing films always raises U
    assert construction.r_factor > construction.r_value > 0

    aperture = next(a for f in primary_data.faces for a in f.apertures)
    window = aperture.properties.energy.construction
    assert window is not None
    assert window.u_factor > 0
    assert window.u_value > 0
    assert window.r_factor > window.r_value > 0


def test_primary_spaces_and_floor_segments(primary_data: CombinedModelDataSchema) -> None:
    assert primary_data.load_summary.spaces_extracted == 4
    segments = [seg for s in primary_data.spaces for v in s.volumes for seg in v.floor.floor_segments]
    assert len(segments) == 5
    for space in primary_data.spaces:
        assert space.net_volume > 0
        assert space.floor_area > 0
        assert space.weighted_floor_area > 0
        assert space.wufi_type == 99
        assert space.properties.ph is not None


def test_primary_shade_groups_merged(primary_data: CombinedModelDataSchema) -> None:
    """5 distinct display_names → 5 groups, each ONE merged mesh (crit. 5)."""
    assert primary_data.load_summary.shade_groups_extracted == 5
    assert len(primary_data.shading_elements) == 5
    for group in primary_data.shading_elements:
        assert len(group.shades) == 1
        mesh = group.shades[0].geometry.mesh
        assert mesh is not None
        assert mesh.faces


def test_primary_ventilation_duct_type_normalized(primary_data: CombinedModelDataSchema) -> None:
    """One system shared across 4 rooms dedupes to one DTO; duct_type is
    forced from list membership (crit. 7) — the fixture's GH export tags
    the exhaust duct duct_type=1 like the supply duct."""
    assert len(primary_data.ventilation_systems) == 1
    system = primary_data.ventilation_systems[0]
    assert len(system.supply_ducting) == 1
    assert len(system.exhaust_ducting) == 1
    assert all(d.duct_type == 1 for d in system.supply_ducting)
    assert all(d.duct_type == 2 for d in system.exhaust_ducting)
    assert sum(len(d.segments) for d in system.supply_ducting) == 3
    assert sum(len(d.segments) for d in system.exhaust_ducting) == 2
    for duct in system.supply_ducting + system.exhaust_ducting:
        for segment in duct.segments.values():
            assert segment.diameter > 0


def test_primary_hot_water_tree_depth(primary_data: CombinedModelDataSchema) -> None:
    """System → Trunk → Branch → Fixture → 4 segments (crit.: HW tree)."""
    assert len(primary_data.hot_water_systems) == 1
    system = primary_data.hot_water_systems[0]
    assert len(system.distribution_piping) == 1
    trunk = next(iter(system.distribution_piping.values()))
    assert len(trunk.branches) == 1
    branch = next(iter(trunk.branches.values()))
    assert len(branch.fixtures) == 1
    fixture = next(iter(branch.fixtures.values()))
    assert len(fixture.segments) == 4
    for segment in fixture.segments.values():
        assert segment.length > 0
        assert segment.diameter_mm > 0


def test_primary_sun_path_is_null(primary_data: CombinedModelDataSchema) -> None:
    """D-07: sun-path generation is blocked on model-viewer wiring; the key
    exists and is null so the wire shape won't change when wiring lands."""
    assert primary_data.sun_path is None


def test_primary_geometry_summary() -> None:
    summary = extract_geometry_summary(_load_primary_model())
    assert summary.volume_m3 == pytest.approx(1129.65, abs=0.5)
    assert summary.envelope_area_m2 == pytest.approx(832.32, abs=0.5)
    assert summary.floor_area_m2 == pytest.approx(376.55, abs=0.5)


# ----------------------------- wire format ---------------------------------


def test_airflow_wire_is_m3s_with_v1_alias_names() -> None:
    """US-VIEW-7 crit. 1: m³/s on the wire, no ×3600; alias names match
    V1's wire (`properties.ph._v_sup`) for the frontend loaders."""
    model = _load_primary_model()
    space = model.rooms[0].properties.ph.spaces[0]
    space.properties.ph._v_sup = 0.125
    space.properties.ph._v_eta = 0.100
    space.properties.ph._v_tran = 0.025

    data = extract_model_data(model)
    payload = data.model_dump(mode="json", by_alias=True)
    ph_props = [s["properties"]["ph"] for s in payload["spaces"] if s["properties"]["ph"]["_v_sup"] is not None]
    assert len(ph_props) == 1
    assert ph_props[0]["_v_sup"] == pytest.approx(0.125)  # NOT 450 (m³/h)
    assert ph_props[0]["_v_eta"] == pytest.approx(0.100)
    assert ph_props[0]["_v_tran"] == pytest.approx(0.025)


# --------------------------- synthetic paths -------------------------------


def test_air_boundary_face_skipped_logged_and_counted() -> None:
    """Q-VIEW-1: AirBoundary faces are dropped from the wire but counted."""
    model = _load_primary_model()
    model.faces[0].type = face_types.air_boundary
    data = extract_model_data(model)
    assert data.load_summary.air_boundaries_skipped == 1
    assert data.load_summary.faces_extracted == 24


def test_adiabatic_boundary_condition_on_wire_and_out_of_envelope() -> None:
    """Neither fixture has Adiabatic faces; they must pass through to the
    wire (Boundary theme bucket) but stay out of the envelope-area summary."""
    model = _load_primary_model()
    # honeybee forbids Adiabatic on faces with apertures — pick a bare one.
    target = next(f for f in model.faces if type(f.boundary_condition).__name__ == "Outdoors" and not f.apertures)
    baseline = extract_geometry_summary(model)
    target.boundary_condition = Adiabatic()

    data = extract_model_data(model)
    assert Counter(f.boundary_condition.type for f in data.faces)["Adiabatic"] == 1
    summary = extract_geometry_summary(model)
    assert summary.envelope_area_m2 < baseline.envelope_area_m2


def test_recirc_piping_on_wire() -> None:
    """Neither fixture carries recirculation piping (flat list, no
    trunk/branch/fixture nesting) — synthesize one segment per room."""
    model = _load_primary_model()
    for room in model.rooms:
        system = room.properties.ph_hvac.hot_water_system
        if system is None:
            continue
        element = hwp.PhHvacPipeElement()
        element.add_segment(hwp.PhHvacPipeSegment(LineSegment3D.from_end_points(Point3D(0, 0, 0), Point3D(2, 0, 0))))
        system.add_recirc_piping(element)

    data = extract_model_data(model)
    recirc = data.hot_water_systems[0].recirc_piping
    assert len(recirc) == 1
    segment = next(iter(next(iter(recirc.values())).segments.values()))
    assert segment.length == pytest.approx(2.0)
    assert segment.geometry.p == (0.0, 0.0, 0.0)


def test_invalid_hbjson_raises_permanent_parse_error() -> None:
    """D-16: the error names the cause incl. declared vs. supported schema
    versions so the file-popover tooltip is actionable."""
    with pytest.raises(ModelParseError) as excinfo:
        parse_hb_model({"type": "Model", "identifier": "junk", "version": "99.0.0"})
    message = str(excinfo.value)
    assert "99.0.0" in message
    assert "honeybee-schema" in message


# ------------------------- Hillandale scale fixture ------------------------


@pytest.fixture(scope="module")
def hillandale() -> tuple[CombinedModelDataSchema, Any]:
    """Parse + extract the 52 MB multifamily fixture once per module.

    This module-scoped single parse IS the D-15 perf canary — the
    `hillandale` marker keeps it out of quick local loops
    (`-m 'not hillandale'`); CI always runs it.
    """
    model = parse_hb_model(json.loads(HILLANDALE_FIXTURE.read_text()))
    return extract_model_data(model), extract_geometry_summary(model)


@pytest.mark.hillandale
def test_hillandale_golden_counts(hillandale: tuple[CombinedModelDataSchema, Any]) -> None:
    data, _ = hillandale
    assert data.load_summary.faces_extracted == 6178
    assert data.load_summary.spaces_extracted == 583
    assert data.load_summary.air_boundaries_skipped == 0
    assert Counter(f.face_type for f in data.faces) == {"Wall": 4591, "Floor": 798, "RoofCeiling": 789}
    assert Counter(f.boundary_condition.type for f in data.faces) == {
        "Outdoors": 831,
        "Surface": 5248,
        "Ground": 99,
    }
    assert sum(len(f.apertures) for f in data.faces) == 1024
    window_constructions = {
        a.properties.energy.construction.identifier
        for f in data.faces
        for a in f.apertures
        if a.properties.energy.construction is not None
    }
    assert len(window_constructions) == 62


@pytest.mark.hillandale
def test_hillandale_253_shades_merge_to_one_group(hillandale: tuple[CombinedModelDataSchema, Any]) -> None:
    """253 orphaned shades share one display_name → ONE merged mesh —
    the shade-merging stress test."""
    data, _ = hillandale
    assert data.load_summary.shade_groups_extracted == 1
    assert len(data.shading_elements) == 1
    mesh = data.shading_elements[0].shades[0].geometry.mesh
    assert mesh is not None
    assert len(mesh.faces) >= 253  # at least one triangle per source shade


@pytest.mark.hillandale
def test_hillandale_floor_weighting_buckets(hillandale: tuple[CombinedModelDataSchema, Any]) -> None:
    data, _ = hillandale
    segments = [seg for s in data.spaces for v in s.volumes for seg in v.floor.floor_segments]
    assert len(segments) == 583
    weighting = Counter(round(seg.weighting_factor, 2) for seg in segments)
    assert weighting == {1.0: 561, 0.0: 22}


@pytest.mark.hillandale
def test_hillandale_inches_normalized_to_meters(hillandale: tuple[CombinedModelDataSchema, Any]) -> None:
    """The source file is Inches; everything on the wire must be Meters.

    The frozen values are golden (first verified 2026-06-12); the sanity
    check below them is unit-scale-sensitive — in inches the average
    storey height would be ~100, not ~3.5.
    """
    _, summary = hillandale
    assert summary.volume_m3 == pytest.approx(129409, rel=1e-3)
    assert summary.envelope_area_m2 == pytest.approx(24071, rel=1e-3)
    assert summary.floor_area_m2 == pytest.approx(36279, rel=1e-3)
    assert 2.0 < summary.volume_m3 / summary.floor_area_m2 < 5.0
