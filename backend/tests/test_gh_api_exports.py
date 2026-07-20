"""Phase 02 tests for the GH composed export routes.

Parity is verified as in-process unit tests on the serializers (synthetic,
public-repo-safe values only — never PHI/PHPP/WUFI data), plus route smokes for
wiring/envelope. The rich construction payload is round-tripped through
`OpaqueConstruction.from_dict` to prove PhColor / refs / division grid / ph_nav
external ids survive.
"""

from __future__ import annotations

from typing import Any, cast

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from honeybee_energy.construction.opaque import OpaqueConstruction

from features.gh_api.aperture_types_export import export_aperture_types
from features.gh_api.constructions_export import export_rich_constructions
from features.project_document.document import (
    ApertureElement,
    ApertureElementFrames,
    ApertureOperation,
    ApertureTypeEntry,
    Assembly,
    AssemblyLayer,
    AssemblySegment,
    ProjectDocumentV1,
    ProjectFrame,
    ProjectGlazing,
    ProjectMaterial,
)
from features.project_document.templates import empty_project_document
from features.projects.models import CreateProjectRequest
from main import app
from tests.test_gh_api_foundation import _create_project, _gh_url
from tests.test_project_document import signed_in_client


def _document() -> ProjectDocumentV1:
    return empty_project_document(CreateProjectRequest(name="GH Export Fixture", bt_number="2600"))


def _material(suffix: str, *, conductivity: float | None = 0.035, color: str | None = "#40C080") -> ProjectMaterial:
    return ProjectMaterial(
        id=f"pmat_{suffix}",
        name=f"Material {suffix}",
        category="insulation",
        conductivity_w_mk=conductivity,
        density_kg_m3=30.0,
        specific_heat_j_kgk=1000.0,
        color=color,
        specification_status="complete",
        datasheet_asset_ids=["asset_ds_1"],
    )


def _segment(
    suffix: str, *, order: int = 0, width_mm: float = 400.0, steel_stud: float | None = None
) -> AssemblySegment:
    return AssemblySegment(
        id=f"seg_{suffix}",
        order=order,
        width_mm=width_mm,
        steel_stud_spacing_mm=steel_stud,
        project_material_id=f"pmat_{suffix}",
        photo_asset_ids=["asset_photo_1"],
    )


def _simple_assembly() -> Assembly:
    return Assembly(
        id="asm_simple",
        name="Simple Wall",
        type="wall",
        orientation="first_layer_outside",
        layers=[AssemblyLayer(id="lyr_0", order=0, thickness_mm=100.0, segments=[_segment("a")])],
    )


# --- constructions/hbjson ---------------------------------------------------


def test_simple_construction_round_trips_rich_properties() -> None:
    body = _document()
    body.tables.project_materials = [_material("a")]
    body.tables.assemblies = [_simple_assembly()]

    payload, warnings = export_rich_constructions(body)
    assert set(payload) == {"Simple Wall"}
    assert warnings == []

    construction = OpaqueConstruction.from_dict(payload["Simple Wall"])
    assert construction.materials[0].thickness == pytest.approx(0.1)
    material_dict = payload["Simple Wall"]["materials"][0]
    ph = material_dict["properties"]["ph"]
    ref = material_dict["properties"]["ref"]
    assert ph["ph_color"] == {"a": 255, "r": 64, "g": 192, "b": 128}
    assert ref["external_identifiers"]["ph_nav"] == "pmat_a"
    # honeybee_energy_ref canonicalizes the status to upper case.
    assert ref["ref_status"] == "COMPLETE"
    assert ref["document_refs"][0]["document_uri"] == "phn-asset:asset_ds_1"
    assert ref["image_refs"][0]["full_size_image_uri"] == "phn-asset:asset_photo_1"


def test_rich_export_maps_canonical_needed_to_external_missing() -> None:
    """D-6: installed `honeybee_ref` accepts only COMPLETE|MISSING|QUESTION|NA,
    so PH-Navigator's canonical `needed` crosses the boundary as MISSING."""

    body = _document()
    material = _material("a")
    material.specification_status = "needed"
    body.tables.project_materials = [material]
    body.tables.assemblies = [_simple_assembly()]

    payload, warnings = export_rich_constructions(body)

    assert warnings == []
    assert payload["Simple Wall"]["materials"][0]["properties"]["ref"]["ref_status"] == "MISSING"


def test_hybrid_layer_uses_equivalent_conductivity_and_keeps_base_thermal_mass() -> None:
    body = _document()
    body.tables.project_materials = [_material("ins", conductivity=0.035), _material("wood", conductivity=0.12)]
    body.tables.assemblies = [
        Assembly(
            id="asm_hybrid",
            name="Hybrid Wall",
            type="wall",
            orientation="first_layer_outside",
            layers=[
                AssemblyLayer(
                    id="lyr_0",
                    order=0,
                    thickness_mm=140.0,
                    segments=[_segment("ins", order=0, width_mm=400.0), _segment("wood", order=1, width_mm=38.0)],
                )
            ],
        )
    ]

    material = export_rich_constructions(body)[0]["Hybrid Wall"]["materials"][0]
    # Width-weighted equivalent conductivity sits between the two segment values.
    assert 0.035 < material["conductivity"] < 0.12
    # Documented V1 limitation: density/specific-heat stay the base material's.
    assert material["density"] == pytest.approx(30.0)
    assert material["specific_heat"] == pytest.approx(1000.0)
    assert "divisions" in material["properties"]["ph"]


def test_steel_stud_segment_carries_spacing_in_division_grid() -> None:
    body = _document()
    body.tables.project_materials = [_material("cav", conductivity=0.04), _material("stud", conductivity=50.0)]
    body.tables.assemblies = [
        Assembly(
            id="asm_ss",
            name="Steel Stud Wall",
            type="wall",
            orientation="first_layer_outside",
            layers=[
                AssemblyLayer(
                    id="lyr_0",
                    order=0,
                    thickness_mm=152.0,
                    segments=[
                        _segment("cav", order=0, width_mm=400.0, steel_stud=406.4),
                        _segment("stud", order=1, width_mm=1.5),
                    ],
                )
            ],
        )
    ]

    divisions = export_rich_constructions(body)[0]["Steel Stud Wall"]["materials"][0]["properties"]["ph"]["divisions"]
    assert divisions["steel_stud_spacing_mm"] == pytest.approx(406.4)
    # Two segments -> two grid columns, each carrying its cell material.
    assert len(divisions["column_widths"]) == 2
    assert len(divisions["cells"]) == 2


def test_flipped_orientation_reverses_layer_order() -> None:
    body = _document()
    body.tables.project_materials = [_material("out"), _material("in")]
    layers = [
        AssemblyLayer(id="lyr_0", order=0, thickness_mm=50.0, segments=[_segment("out")]),
        AssemblyLayer(id="lyr_1", order=1, thickness_mm=50.0, segments=[_segment("in")]),
    ]
    first_out = Assembly(id="asm_f", name="First Out", type="wall", orientation="first_layer_outside", layers=layers)
    last_out = Assembly(id="asm_l", name="Last Out", type="wall", orientation="last_layer_outside", layers=layers)
    body.tables.assemblies = [first_out, last_out]

    payload, _ = export_rich_constructions(body)
    first_ids = [m["identifier"] for m in payload["First Out"]["materials"]]
    last_ids = [m["identifier"] for m in payload["Last Out"]["materials"]]
    assert last_ids == list(reversed(first_ids))


def test_duplicate_assembly_names_rejected() -> None:
    body = _document()
    body.tables.project_materials = [_material("a")]
    dup = _simple_assembly()
    other = Assembly(
        id="asm_two",
        name="Simple Wall",
        type="wall",
        orientation="first_layer_outside",
        layers=[AssemblyLayer(id="lyr_0", order=0, thickness_mm=100.0, segments=[_segment("a")])],
    )
    body.tables.assemblies = [dup, other]

    with pytest.raises(HTTPException) as excinfo:
        export_rich_constructions(body)
    assert excinfo.value.status_code == 409


def test_material_missing_thermal_props_is_422() -> None:
    body = _document()
    body.tables.project_materials = [_material("a", conductivity=None)]
    body.tables.assemblies = [_simple_assembly()]

    with pytest.raises(HTTPException) as excinfo:
        export_rich_constructions(body)
    assert excinfo.value.status_code == 422


def _missing_fields(exc: HTTPException) -> list[str]:
    return cast(dict[str, Any], exc.detail)["details"]["missing"]


def _material_missing_mass(suffix: str) -> ProjectMaterial:
    """A material complete except for both thermal-mass fields."""
    material = _material(suffix)
    material.density_kg_m3 = None
    material.specific_heat_j_kgk = None
    return material


def test_missing_thermal_mass_still_422s_in_strict_mode() -> None:
    body = _document()
    body.tables.project_materials = [_material_missing_mass("a")]
    body.tables.assemblies = [_simple_assembly()]

    with pytest.raises(HTTPException) as excinfo:
        export_rich_constructions(body, "strict")
    assert excinfo.value.status_code == 422
    assert set(_missing_fields(excinfo.value)) == {"density_kg_m3", "specific_heat_j_kgk"}


def test_user_defaults_fills_thermal_mass_and_warns() -> None:
    body = _document()
    body.tables.project_materials = [_material_missing_mass("a")]
    body.tables.assemblies = [_simple_assembly()]

    payload, warnings = export_rich_constructions(body, "user_defaults")

    material = payload["Simple Wall"]["materials"][0]
    assert material["density"] == pytest.approx(600.0)
    assert material["specific_heat"] == pytest.approx(1000.0)

    assert len(warnings) == 1
    warning = warnings[0]
    assert warning.code == "material_thermal_defaulted"
    assert warning.details == {
        "assembly": "Simple Wall",
        "segment_id": "seg_a",
        "project_material_id": "pmat_a",
        "defaulted_fields": ["density_kg_m3", "specific_heat_j_kgk"],
    }


def test_user_defaults_still_422s_on_missing_conductivity() -> None:
    body = _document()
    body.tables.project_materials = [_material("a", conductivity=None)]
    body.tables.assemblies = [_simple_assembly()]

    with pytest.raises(HTTPException) as excinfo:
        export_rich_constructions(body, "user_defaults")
    assert excinfo.value.status_code == 422
    assert _missing_fields(excinfo.value) == ["conductivity_w_mk"]


def test_user_defaults_only_defaults_the_missing_field() -> None:
    body = _document()
    material = _material("a")
    material.density_kg_m3 = None  # specific-heat is present
    body.tables.project_materials = [material]
    body.tables.assemblies = [_simple_assembly()]

    payload, warnings = export_rich_constructions(body, "user_defaults")

    assert payload["Simple Wall"]["materials"][0]["density"] == pytest.approx(600.0)
    assert payload["Simple Wall"]["materials"][0]["specific_heat"] == pytest.approx(1000.0)
    assert warnings[0].details["defaulted_fields"] == ["density_kg_m3"]


# --- aperture-types ---------------------------------------------------------


def _aperture_fixture() -> ProjectDocumentV1:
    body = _document()
    body.tables.project_glazings = [ProjectGlazing(id="pglz_g1", name="Triple", u_value_w_m2k=0.6, g_value=0.5)]
    body.tables.project_frames = [
        ProjectFrame(
            id="pfrm_f1", name="Frame A", width_mm=90.0, u_value_w_m2k=0.9, psi_g_w_mk=0.03, psi_install_w_mk=0.04
        ),
    ]
    body.tables.apertures = [
        ApertureTypeEntry(
            id="apt_1",
            name="Big Window",
            row_heights_mm=[1000.0, 500.0],
            column_widths_mm=[600.0, 400.0],
            elements=[
                ApertureElement(
                    id="aptel_span",
                    name="Fixed Lite",
                    row_span=(0, 1),
                    column_span=(0, 0),
                    frames=ApertureElementFrames(top="pfrm_f1", right="pfrm_f1", bottom="pfrm_f1", left="pfrm_f1"),
                    glazing_id="pglz_g1",
                    operation=ApertureOperation(type="swing", directions=["left"]),
                ),
                ApertureElement(
                    id="aptel_fixed",
                    name="Corner",
                    row_span=(0, 0),
                    column_span=(1, 1),
                    glazing_id="pglz_g1",
                ),
                ApertureElement(id="aptel_b", name="B", row_span=(1, 1), column_span=(1, 1), glazing_id="pglz_g1"),
            ],
        )
    ]
    return body


def test_aperture_types_span_and_inlined_refs() -> None:
    payload = export_aperture_types(_aperture_fixture())
    aperture = payload["Big Window"]
    assert aperture["row_heights_mm"] == [1000.0, 500.0]

    spanning = next(e for e in aperture["elements"] if e["name"] == "Fixed Lite")
    # Inclusive (0,1) rows -> row_number 0, row_span count 2; single column -> col_span 1.
    assert (spanning["row_number"], spanning["row_span"]) == (0, 2)
    assert (spanning["column_number"], spanning["col_span"]) == (0, 1)
    assert spanning["glazing"]["glazing_type"]["u_value_w_m2k"] == 0.6
    assert spanning["frames"]["top"]["frame_type"]["psi_install_w_mk"] == 0.04
    assert spanning["operation"] == {"type": "swing", "directions": ["left"]}

    fixed = next(e for e in aperture["elements"] if e["name"] == "Corner")
    assert fixed["operation"] is None
    assert fixed["frames"]["top"] is None


def test_duplicate_aperture_type_names_rejected() -> None:
    body = _aperture_fixture()
    body.tables.apertures = [body.tables.apertures[0], body.tables.apertures[0]]
    with pytest.raises(HTTPException) as excinfo:
        export_aperture_types(body)
    assert excinfo.value.status_code == 409


# --- route smokes -----------------------------------------------------------


def test_export_routes_smoke_on_empty_project(clean_document_tables: None) -> None:
    client = signed_in_client()
    _create_project(client, "2600")
    anon = TestClient(app)

    for suffix, key in (
        ("/constructions/hbjson", "hb_constructions"),
        ("/aperture-types", "aperture_types"),
        ("/aperture-constructions/hbjson", "hb_constructions"),
    ):
        response = anon.get(_gh_url("2600") + suffix)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body[key] == {}
        assert body["schema_version"] == 1
        assert body["last_modified"].endswith("Z")
        assert body["warnings"] == []


def test_constructions_route_accepts_on_missing_thermal(clean_document_tables: None) -> None:
    client = signed_in_client()
    _create_project(client, "2600")
    anon = TestClient(app)
    url = _gh_url("2600") + "/constructions/hbjson"

    ok = anon.get(url, params={"on_missing_thermal": "user_defaults"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["warnings"] == []

    # FastAPI rejects any value outside the Literal before the handler runs.
    assert anon.get(url, params={"on_missing_thermal": "bogus"}).status_code == 422
