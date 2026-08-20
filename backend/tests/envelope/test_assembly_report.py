from __future__ import annotations

import json
from pathlib import Path

from features.envelope.assembly_report import build_assembly_report_page, natural_sort_assemblies
from features.project_document.document import Assembly, ProjectMaterial

FIXTURE_PATH = Path(__file__).parents[3] / "frontend/src/features/envelope/__fixtures__/assembly-report-parity.json"


def test_backend_projection_matches_frontend_parity_fixture() -> None:
    fixture = json.loads(FIXTURE_PATH.read_text())
    assembly = Assembly.model_validate(fixture["assembly"])
    materials = [ProjectMaterial.model_validate(item) for item in fixture["materials"]]

    page = build_assembly_report_page(assembly, materials, units=fixture["units"])

    assert page.model_dump(mode="json") == fixture["expected"]


def test_backend_projection_matches_frontend_ip_material_and_thickness_contract() -> None:
    fixture = json.loads(FIXTURE_PATH.read_text())
    assembly = Assembly.model_validate(fixture["assembly"])
    materials = [ProjectMaterial.model_validate(item) for item in fixture["materials"]]

    page = build_assembly_report_page(assembly, materials, units="IP")

    assert {
        "material_headers": [item.model_dump(mode="json") for item in page.material_headers],
        "layer_thickness_labels": [item.thickness_label for item in page.layers],
        "materials": [item.model_dump(mode="json") for item in page.materials],
    } == fixture["expected_ip"]


def test_backend_projection_normalizes_valid_out_of_order_arrays_and_rounds_half_up() -> None:
    fixture = json.loads(FIXTURE_PATH.read_text())
    raw_assembly = fixture["assembly"]
    raw_assembly["layers"].reverse()
    for layer in raw_assembly["layers"]:
        layer["segments"].reverse()
    assembly = Assembly.model_validate(raw_assembly)
    materials = [ProjectMaterial.model_validate(item) for item in fixture["materials"]]

    ordered = build_assembly_report_page(assembly, materials, units="SI")
    rounding_assembly = assembly.model_copy(
        update={
            "layers": [
                layer.model_copy(update={"thickness_mm": fixture["rounding_cases"]["length_mm"]})
                if layer.order == 0
                else layer
                for layer in assembly.layers
            ]
        }
    )
    rounding = build_assembly_report_page(rounding_assembly, materials, units="SI")

    assert [layer.layer_id for layer in ordered.layers] == [
        layer["layer_id"] for layer in fixture["expected"]["layers"]
    ]
    assert [segment.segment_id for segment in ordered.layers[0].segments] == [
        "seg_insulation_a",
        "seg_missing",
    ]
    assert rounding.layers[0].thickness_label == fixture["rounding_cases"]["expected_si"]


def test_natural_sort_uses_portable_numeric_name_order_and_id_tie_break() -> None:
    base = Assembly.model_validate(json.loads(FIXTURE_PATH.read_text())["assembly"])
    assemblies = [
        base.model_copy(update={"id": "asm_z", "name": "WALL-02"}),
        base.model_copy(update={"id": "asm_10", "name": "WALL-10"}),
        base.model_copy(update={"id": "asm_1", "name": "WALL-1"}),
        base.model_copy(update={"id": "asm_a", "name": "WALL-2"}),
    ]

    assert [item.id for item in natural_sort_assemblies(assemblies)] == [
        "asm_1",
        "asm_a",
        "asm_z",
        "asm_10",
    ]
