"""Membrane handling in the HBJSON and PHPP export paths (PRD §7)."""

from __future__ import annotations

from typing import Any, cast

from features.envelope.commands.materials import assign_segment_material
from features.envelope.hbjson_export import export_hbjson_constructions
from features.envelope.hbjson_import import parse_construction_library
from features.envelope.import_planning import _build_assembly
from features.envelope.membranes import total_thickness_mm
from features.envelope.phpp_export import build_assembly_export_plan
from features.envelope.selectors import build_envelope_read_parts
from features.envelope.thermal import thermal_issue_flags, thermal_issues
from features.project_document.document import CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION, ProjectDocumentV1
from tests.envelope.test_envelope_document_contracts import (
    assembly,
    base_document,
    project_material,
)

WALL_ID = "asm_membrane_wall"


def _construction(payload: dict[str, object]) -> dict[str, Any]:
    """Narrow the export's `dict[str, object]` down to the one construction."""
    constructions = cast(dict[str, Any], payload["constructions"])
    return cast(dict[str, Any], constructions["WALL_MEMBRANE"])


# `material_id` is optional so a test can build the unassigned layer that a
# freshly added one starts as.
def _segment(seg_id: str, material_id: str | None, width_mm: float = 1000.0) -> dict[str, object]:
    return {
        "id": seg_id,
        "order": 0,
        "width_mm": width_mm,
        "is_continuous_insulation": False,
        "steel_stud_spacing_mm": None,
        "project_material_id": material_id,
        "photo_asset_ids": [],
        "use_site_notes": None,
    }


def _membrane_body() -> ProjectDocumentV1:
    """Gypsum / poly VB / insulation / WRB, outside-last, air barrier on the WRB.

    Two membranes, one between two ordinary layers and one at the very end, so
    the splice-back-by-index path is exercised at both an interior and a
    boundary position.
    """
    raw = base_document().model_dump(mode="json")
    raw["tables"]["project_materials"] = [
        project_material(id="pmat_gyp", name="Gypsum", category="finishes", conductivity_w_mk=0.25),
        project_material(
            id="pmat_poly",
            name="6-mil Poly VB",
            category="membrane",
            conductivity_w_mk=None,
            air_permeance_l_s_m2_at_75pa=0.0001,
            datasheet_asset_ids=[],
        ),
        project_material(id="pmat_insul", name="Mineral Wool", category="insulation", conductivity_w_mk=0.038),
        project_material(
            id="pmat_wrb",
            name="Self-Adhered WRB",
            category="membrane",
            conductivity_w_mk=None,
            air_permeance_l_s_m2_at_75pa=0.0012,
            datasheet_asset_ids=[],
        ),
    ]
    raw["tables"]["assemblies"] = [
        assembly(
            id=WALL_ID,
            name="WALL-MEMBRANE",
            orientation="first_layer_outside",
            air_barrier={"layer_id": "lyr_wrb", "face": "exterior"},
            layers=[
                {"id": "lyr_gyp", "order": 0, "thickness_mm": 12.7, "segments": [_segment("seg_gyp", "pmat_gyp")]},
                {"id": "lyr_poly", "order": 1, "thickness_mm": 0.15, "segments": [_segment("seg_poly", "pmat_poly")]},
                {
                    "id": "lyr_insul",
                    "order": 2,
                    "thickness_mm": 140.0,
                    "segments": [_segment("seg_insul", "pmat_insul")],
                },
                {"id": "lyr_wrb", "order": 3, "thickness_mm": 0.8, "segments": [_segment("seg_wrb", "pmat_wrb")]},
            ],
        )
    ]
    return ProjectDocumentV1.model_validate(raw)


def test_hbjson_construction_omits_membranes_but_keeps_the_real_layers() -> None:
    """An `EnergyMaterial` needs a positive conductivity; membranes have none."""
    construction = _construction(export_hbjson_constructions(_membrane_body()))

    assert [material["display_name"] for material in construction["materials"]] == ["Gypsum", "Mineral Wool"]
    for material in construction["materials"]:
        assert material["conductivity"] is not None


def test_membranes_ride_the_ph_nav_block_with_their_positions_and_fields() -> None:
    ph_nav = _construction(export_hbjson_constructions(_membrane_body()))["ph_nav"]

    assert ph_nav["air_barrier"] == {"layer_id": "lyr_wrb", "face": "exterior"}
    membranes = ph_nav["membrane_layers"]
    assert [entry["outside_index"] for entry in membranes] == [1, 3]
    assert [entry["layer_id"] for entry in membranes] == ["lyr_poly", "lyr_wrb"]
    assert membranes[0]["thickness_mm"] == 0.15
    # The air-permeance value has no honeybee home, so `ph_nav` is the only
    # thing standing between it and a lossy round trip.
    assert membranes[1]["material"]["air_permeance_l_s_m2_at_75pa"] == 0.0012
    assert membranes[1]["material"]["category"] == "membrane"


def test_export_import_round_trip_restores_membranes_in_order() -> None:
    """PRD §9 criterion 6 — the round trip is why `ph_nav` carries them at all."""
    payload = export_hbjson_constructions(_membrane_body())

    library = parse_construction_library(payload, current_schema_version=CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION)

    construction = library.constructions[0]
    assert [layer.source_layer_id for layer in construction.layers] == [
        "lyr_gyp",
        "lyr_poly",
        "lyr_insul",
        "lyr_wrb",
    ]
    assert [layer.thickness_mm for layer in construction.layers] == [12.7, 0.15, 140.0, 0.8]

    wrb = library.materials["pmat_wrb"]
    assert wrb.category == "membrane"
    assert wrb.air_permeance_l_s_m2_at_75pa == 0.0012
    # Never invent a conductivity for a membrane: the thermal engine excludes
    # them, and a positive value would put the layer back into the R sum.
    assert wrb.conductivity_w_mk is None


def test_round_trip_restores_the_air_barrier_designation() -> None:
    """Exporting it and never reading it back would be the round-trip loss `ph_nav` exists to stop."""
    payload = export_hbjson_constructions(_membrane_body())

    library = parse_construction_library(payload, current_schema_version=CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION)

    assert library.constructions[0].air_barrier == {"layer_id": "lyr_wrb", "face": "exterior"}


def test_a_malformed_air_barrier_is_dropped_rather_than_failing_the_import() -> None:
    """Import is forgiving: a hand-edited file should lose an annotation, not blow up."""
    payload = export_hbjson_constructions(_membrane_body())
    _construction(payload)["ph_nav"]["air_barrier"] = {"layer_id": "lyr_wrb", "face": "sideways"}

    library = parse_construction_library(payload, current_schema_version=CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION)

    assert library.constructions[0].air_barrier is None


def test_round_trip_holds_for_the_other_orientation() -> None:
    """`materials[]` is canonically outside→inside, so the flip must survive it."""
    raw = _membrane_body().model_dump(mode="json")
    raw["tables"]["assemblies"][0]["orientation"] = "last_layer_outside"
    payload = export_hbjson_constructions(ProjectDocumentV1.model_validate(raw))

    library = parse_construction_library(payload, current_schema_version=CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION)

    assert [layer.source_layer_id for layer in library.constructions[0].layers] == [
        "lyr_gyp",
        "lyr_poly",
        "lyr_insul",
        "lyr_wrb",
    ]


def test_a_foreign_multi_layer_construction_still_gets_unique_layer_ids() -> None:
    """Foreign layers all carry `source_layer_id is None`, so id minting must not memoize on it."""
    library = parse_construction_library(
        {
            "type": "OpaqueConstruction",
            "identifier": "W_Foreign",
            "materials": [
                {"identifier": "gyp", "display_name": "Gypsum", "thickness": 0.0127, "conductivity": 0.25},
                {"identifier": "insul", "display_name": "Insulation", "thickness": 0.14, "conductivity": 0.038},
            ],
        },
        current_schema_version=CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION,
    )
    construction = library.constructions[0]
    assert [layer.source_layer_id for layer in construction.layers] == [None, None]
    resolution_map = {key: "pmat_insul" for key in library.materials}

    built = _build_assembly(construction, "asm_foreign", resolution_map, "Foreign Wall")

    # Constructing the `Assembly` at all is the assertion: the document's
    # `validate_unique_ids` rejects duplicates, and memoizing minted ids by a
    # source id of `None` collapsed every foreign layer onto one.
    assert len({layer.id for layer in built.layers}) == 2
    assert built.air_barrier is None


def test_a_membrane_with_no_recorded_name_keeps_its_layer() -> None:
    """Dropping the entry would delete a real layer — thickness, position and all."""
    payload = export_hbjson_constructions(_membrane_body())
    for entry in _construction(payload)["ph_nav"]["membrane_layers"]:
        entry["material"].pop("name")

    library = parse_construction_library(payload, current_schema_version=CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION)

    assert len(library.constructions[0].layers) == 4
    assert [layer.source_layer_id for layer in library.constructions[0].layers] == [
        "lyr_gyp",
        "lyr_poly",
        "lyr_insul",
        "lyr_wrb",
    ]


def test_a_negative_outside_index_prepends_rather_than_landing_mid_stack() -> None:
    """Unclamped, Python reads a negative index as insert-before-the-end."""
    payload = export_hbjson_constructions(_membrane_body())
    _construction(payload)["ph_nav"]["membrane_layers"] = [
        {"outside_index": -5, "layer_id": "lyr_wrb", "segment_id": "seg_wrb", "material": {"name": "WRB"}}
    ]

    library = parse_construction_library(payload, current_schema_version=CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION)

    assert library.constructions[0].layers[0].source_layer_id == "lyr_wrb"


def test_a_split_membrane_layer_is_flagged_as_invalid_geometry() -> None:
    """A legacy split membrane must surface, not be quietly truncated to segment 0 on export."""
    raw = _membrane_body().model_dump(mode="json")
    layers = raw["tables"]["assemblies"][0]["layers"]
    layers[3]["segments"] = [
        _segment("seg_wrb", "pmat_wrb", width_mm=600.0),
        {**_segment("seg_wrb_b", "pmat_poly", width_mm=400.0), "order": 1},
    ]
    body = ProjectDocumentV1.model_validate(raw)
    materials_by_id = {material.id: material for material in body.tables.project_materials}

    flags = thermal_issue_flags(thermal_issues(body.tables.assemblies[0], materials_by_id))

    assert "invalid_geometry" in flags


def test_phpp_drops_membranes_from_the_worksheet_rows_but_records_the_drop() -> None:
    body = _membrane_body()
    materials_by_id = {material.id: material for material in body.tables.project_materials}

    plan = build_assembly_export_plan(body.tables.assemblies[0], materials_by_id)

    assert plan.exportable is True
    assert len(plan.rows) == 2  # gypsum + insulation; the two membranes are gone
    assert plan.dropped_membrane_layer_ids == ["lyr_poly", "lyr_wrb"]
    # Total thickness counts only the rows this export actually writes. It used
    # to include membranes "because they are physically there", which made the
    # CSV disagree with itself: a thickness covering layers the sheet never
    # received. The two membranes (0.15 + 0.8) are excluded.
    assert plan.total_thickness_cm == (12.7 + 140.0) / 10.0


def test_an_all_membrane_assembly_is_not_phpp_exportable() -> None:
    """Otherwise it resolves to one 100% section and writes a blank CSV as "exportable"."""
    raw = _membrane_body().model_dump(mode="json")
    raw["tables"]["assemblies"][0]["layers"] = [
        {"id": "lyr_poly", "order": 0, "thickness_mm": 0.15, "segments": [_segment("seg_poly", "pmat_poly")]},
        {"id": "lyr_wrb", "order": 1, "thickness_mm": 0.8, "segments": [_segment("seg_wrb", "pmat_wrb")]},
    ]
    raw["tables"]["assemblies"][0]["air_barrier"] = None
    body = ProjectDocumentV1.model_validate(raw)
    materials_by_id = {material.id: material for material in body.tables.project_materials}

    plan = build_assembly_export_plan(body.tables.assemblies[0], materials_by_id)

    assert plan.exportable is False
    assert plan.reason == "no_thermal_layers"
    assert plan.rows == []


def test_membranes_do_not_consume_the_eight_row_phpp_budget() -> None:
    """Eight real layers plus membranes must still export, not fail on the cap."""
    raw = _membrane_body().model_dump(mode="json")
    layers = raw["tables"]["assemblies"][0]["layers"]
    filler = [
        {
            "id": f"lyr_fill{index}",
            "order": 0,
            "thickness_mm": 10.0,
            "segments": [_segment(f"seg_fill{index}", "pmat_insul")],
        }
        for index in range(6)
    ]
    combined = [*layers, *filler]
    for order, layer in enumerate(combined):
        layer["order"] = order
    raw["tables"]["assemblies"][0]["layers"] = combined
    body = ProjectDocumentV1.model_validate(raw)
    materials_by_id = {material.id: material for material in body.tables.project_materials}

    plan = build_assembly_export_plan(body.tables.assemblies[0], materials_by_id)

    assert plan.exportable is True
    assert len(plan.rows) == 8  # exactly the PHPP budget, membranes excluded


def test_total_thickness_excludes_membranes_everywhere() -> None:
    """The header chip and the PHPP export must not disagree about the same wall.

    Membrane thickness answers to nothing the user can see: not the section
    (a membrane draws in a fixed band), not the U-value (no R), not the
    condensation result (``sd`` is read from the material). Counting it made
    editing that one field move the total while the drawing stayed put.
    """
    body = _membrane_body()
    materials_by_id = {material.id: material for material in body.tables.project_materials}
    assembly_doc = body.tables.assemblies[0]

    thickness = total_thickness_mm(assembly_doc, materials_by_id)

    assert thickness == 12.7 + 140.0
    # The whole point of one shared definition: the export agrees by construction.
    plan = build_assembly_export_plan(assembly_doc, materials_by_id)
    assert plan.total_thickness_cm == thickness / 10.0
    # And the read model the header consumes reports the same number.
    assemblies, _ = build_envelope_read_parts(body)
    assert assemblies[0].total_thickness_mm == thickness


def test_total_thickness_of_an_all_membrane_assembly_is_zero() -> None:
    """Not a crash and not the layer sum — there is genuinely no build-up depth."""
    raw = _membrane_body().model_dump(mode="json")
    raw["tables"]["assemblies"][0]["layers"] = [
        {"id": "lyr_poly", "order": 0, "thickness_mm": 0.15, "segments": [_segment("seg_poly", "pmat_poly")]},
        {"id": "lyr_wrb", "order": 1, "thickness_mm": 0.8, "segments": [_segment("seg_wrb", "pmat_wrb")]},
    ]
    body = ProjectDocumentV1.model_validate(raw)
    materials_by_id = {material.id: material for material in body.tables.project_materials}

    assert total_thickness_mm(body.tables.assemblies[0], materials_by_id) == 0.0


def test_assigning_a_membrane_snaps_an_untouched_layer_to_a_membrane_thickness() -> None:
    """A new layer arrives at 100 mm, which the canvas cannot show is wrong.

    A membrane draws in a fixed band, so a forgotten 100 mm WRB looks exactly
    like a correct one — the mistake is invisible until it reaches an export.
    """
    raw = _membrane_body().model_dump(mode="json")
    raw["tables"]["assemblies"][0]["air_barrier"] = None
    raw["tables"]["assemblies"][0]["layers"] = [
        {"id": "lyr_new", "order": 0, "thickness_mm": 100.0, "segments": [_segment("seg_new", None)]},
    ]
    body = ProjectDocumentV1.model_validate(raw)

    updated = assign_segment_material(body, WALL_ID, "lyr_new", "seg_new", "pmat_wrb")

    assert updated.tables.assemblies[0].layers[0].thickness_mm == 1.0


def test_the_snap_never_overwrites_a_thickness_the_user_chose() -> None:
    """Only the untouched default is replaced; a deliberate value is theirs."""
    raw = _membrane_body().model_dump(mode="json")
    raw["tables"]["assemblies"][0]["air_barrier"] = None
    raw["tables"]["assemblies"][0]["layers"] = [
        {"id": "lyr_set", "order": 0, "thickness_mm": 3.0, "segments": [_segment("seg_set", None)]},
    ]
    body = ProjectDocumentV1.model_validate(raw)

    updated = assign_segment_material(body, WALL_ID, "lyr_set", "seg_set", "pmat_wrb")

    assert updated.tables.assemblies[0].layers[0].thickness_mm == 3.0


def test_an_ordinary_material_at_the_default_thickness_is_left_alone() -> None:
    """100 mm of mineral wool is a perfectly normal layer."""
    raw = _membrane_body().model_dump(mode="json")
    raw["tables"]["assemblies"][0]["air_barrier"] = None
    raw["tables"]["assemblies"][0]["layers"] = [
        {"id": "lyr_ord", "order": 0, "thickness_mm": 100.0, "segments": [_segment("seg_ord", None)]},
    ]
    body = ProjectDocumentV1.model_validate(raw)

    updated = assign_segment_material(body, WALL_ID, "lyr_ord", "seg_ord", "pmat_insul")

    assert updated.tables.assemblies[0].layers[0].thickness_mm == 100.0


def test_the_snap_sentinel_tracks_the_add_layer_default() -> None:
    """The snap tests equality against the add-layer default, so it must be that default.

    A second hand-written literal would let the two drift, and the failure is
    silent: the snap would simply stop firing.
    """
    from features.envelope.membranes import DEFAULT_NEW_LAYER_THICKNESS_MM
    from features.envelope.models import AddLayerCommand

    assert DEFAULT_NEW_LAYER_THICKNESS_MM == AddLayerCommand.model_fields["thickness_mm"].default
