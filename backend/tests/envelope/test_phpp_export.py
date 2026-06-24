"""PHPP U-Value export: pure-logic mapping, eligibility, and CSV golden tests.

These exercise ``features.envelope.phpp_export`` directly (no HTTP, no DB) by
constructing ``Assembly`` / ``ProjectMaterial`` models in-line, mirroring the
pure thermal tests in ``test_envelope_thermal_and_export``. Routes and the IP
golden land in Phase 2.
"""

from __future__ import annotations

import io
import zipfile

from features.envelope.phpp_export import (
    PHPP_MAX_UVALUE_ROWS,
    build_assembly_export_plan,
    build_phpp_zip,
    render_assembly_csv,
    sanitize_csv_filename,
)
from features.project_document.document import (
    Assembly,
    AssemblyLayer,
    AssemblyOrientation,
    AssemblySegment,
    ProjectDocumentV1,
    ProjectMaterial,
)
from tests.envelope.test_envelope_document_contracts import base_document

# csv.writer terminates every record with CRLF; the goldens join on it so the
# byte output is locked exactly (PRD §10.2).
EOL = "\r\n"

SECTION_HEADER = (
    "Area section 1,λ [W/(mK)],Area section 2 (optional),λ [W/(mK)],Area section 3 (optional),λ [W/(mK)],Thickness [mm]"
)
BLANK_ROW = ",,,,,,"

# --- model builders ---------------------------------------------------------


def _material(material_id: str, name: str, conductivity_w_mk: float | None) -> ProjectMaterial:
    return ProjectMaterial(id=material_id, name=name, category="generic", conductivity_w_mk=conductivity_w_mk)


def _segment(segment_id: str, order: int, width_mm: float, material_id: str | None) -> AssemblySegment:
    return AssemblySegment(id=segment_id, order=order, width_mm=width_mm, project_material_id=material_id)


def _uniform_layer(layer_id: str, order: int, thickness_mm: float, material_id: str | None) -> AssemblyLayer:
    return AssemblyLayer(
        id=layer_id,
        order=order,
        thickness_mm=thickness_mm,
        segments=[_segment(f"seg_{layer_id}", 0, 1000.0, material_id)],
    )


def _assembly(
    name: str,
    layers: list[AssemblyLayer],
    *,
    orientation: AssemblyOrientation = "first_layer_outside",
) -> Assembly:
    return Assembly(id="asm_test", name=name, type="wall", orientation=orientation, layers=layers)


# --- golden: single-section full block --------------------------------------


def _wcs_assembly() -> tuple[Assembly, dict[str, ProjectMaterial]]:
    """W-CS (Crawlspace): three uniform layers, concrete + two Roxul boards."""
    materials = {
        "pmat_concrete": _material("pmat_concrete", "Concrete (Heavily Reinforced)", 2.3),
        "pmat_roxul": _material("pmat_roxul", "Roxul ComfortBoard", 0.036),
    }
    assembly = _assembly(
        "W-CS (Crawlspace)",
        [
            _uniform_layer("lyr_concrete", 0, 200.0, "pmat_concrete"),
            _uniform_layer("lyr_roxul1", 1, 100.0, "pmat_roxul"),
            _uniform_layer("lyr_roxul2", 2, 30.0, "pmat_roxul"),
        ],
    )
    return assembly, materials


def test_single_segment_assembly_renders_golden_si_block() -> None:
    assembly, materials = _wcs_assembly()

    plan = build_assembly_export_plan(assembly, materials)
    csv_text = render_assembly_csv(plan, units="SI")

    assert plan.exportable is True
    assert plan.section_percentages == [100.0]
    assert plan.total_thickness_cm == 33.0
    expected = (
        EOL.join(
            [
                "Description of building assembly,,,,,Assembly no.,",
                "W-CS (Crawlspace),,,,,,",
                BLANK_ROW,
                "Orientation of building assembly (or Rsi),0,,,,Interior insulation?,",
                "Adjacent to (or Rse),0,,,,U-value supplement [W/(m²K)],",
                SECTION_HEADER,
                "Concrete (Heavily Reinforced),2.300,,,,,200",
                "Roxul ComfortBoard,0.036,,,,,100",
                "Roxul ComfortBoard,0.036,,,,,30",
                BLANK_ROW,
                BLANK_ROW,
                BLANK_ROW,
                BLANK_ROW,
                BLANK_ROW,
                "Percentage of sec. 1:,100%,,,,,",
                BLANK_ROW,
                "Heat transmission resistance coefficients,,,,,,",
                "Interior Rsi:,0.00,m²K/W,,,,",
                "Exterior Rse:,0.00,m²K/W,,,,",
                ",,,,,Total thickness [cm]:,33.0",
                ",,,,,U-value [W/(m²K)]:,0.270",
            ]
        )
        + EOL
    )
    assert csv_text == expected


# --- golden: two-section split with broadcast -------------------------------


def _split_layer(layer_id: str, order: int, thickness_mm: float) -> AssemblyLayer:
    """An 850/150 cavity-plus-stud split (the same profile across layers)."""
    return AssemblyLayer(
        id=layer_id,
        order=order,
        thickness_mm=thickness_mm,
        segments=[
            _segment(f"seg_{layer_id}_cav", 0, 850.0, "pmat_cavity"),
            _segment(f"seg_{layer_id}_stud", 1, 150.0, "pmat_stud"),
        ],
    )


def test_two_section_split_renders_golden_with_broadcast() -> None:
    """A uniform layer broadcasts across both sections; two consistent split
    layers (a stud line continuing through them) resolve to 2 area sections."""
    materials = {
        "pmat_sheath": _material("pmat_sheath", "Plywood Sheathing", 0.13),
        "pmat_cavity": _material("pmat_cavity", "Mineral Wool Batt", 0.04),
        "pmat_stud": _material("pmat_stud", "Softwood Stud", 0.13),
    }
    assembly = _assembly(
        "W-Stud",
        [
            _uniform_layer("lyr_sheath", 0, 50.0, "pmat_sheath"),
            _split_layer("lyr_stud1", 1, 140.0),
            _split_layer("lyr_stud2", 2, 38.0),
        ],
    )

    plan = build_assembly_export_plan(assembly, materials)
    csv_text = render_assembly_csv(plan, units="SI")

    assert plan.section_percentages == [85.0, 15.0]
    # The uniform sheathing layer spans both heat-flow paths.
    assert plan.rows[0].sections[0].material_name == "Plywood Sheathing"
    assert plan.rows[0].sections[1].material_name == "Plywood Sheathing"
    expected = (
        EOL.join(
            [
                "Description of building assembly,,,,,Assembly no.,",
                "W-Stud,,,,,,",
                BLANK_ROW,
                "Orientation of building assembly (or Rsi),0,,,,Interior insulation?,",
                "Adjacent to (or Rse),0,,,,U-value supplement [W/(m²K)],",
                SECTION_HEADER,
                "Plywood Sheathing,0.130,Plywood Sheathing,0.130,,,50",
                "Mineral Wool Batt,0.040,Softwood Stud,0.130,,,140",
                "Mineral Wool Batt,0.040,Softwood Stud,0.130,,,38",
                BLANK_ROW,
                BLANK_ROW,
                BLANK_ROW,
                BLANK_ROW,
                BLANK_ROW,
                "Percentage of sec. 1:,85.0%,Percentage of sec. 2:,15.0%,,,",
                BLANK_ROW,
                "Heat transmission resistance coefficients,,,,,,",
                "Interior Rsi:,0.00,m²K/W,,,,",
                "Exterior Rse:,0.00,m²K/W,,,,",
                ",,,,,Total thickness [cm]:,22.8",
                ",,,,,U-value [W/(m²K)]:,0.257",
            ]
        )
        + EOL
    )
    assert csv_text == expected


# --- eligibility: error CSVs, no partial output -----------------------------


def test_too_many_layers_yields_single_line_error_csv() -> None:
    materials = {"pmat_x": _material("pmat_x", "Mat X", 0.5)}
    layers = [_uniform_layer(f"lyr_{index}", index, 20.0, "pmat_x") for index in range(PHPP_MAX_UVALUE_ROWS + 1)]
    assembly = _assembly("Too Many", layers)

    plan = build_assembly_export_plan(assembly, materials)
    csv_text = render_assembly_csv(plan)

    assert plan.exportable is False
    assert plan.reason == "too_many_layers"
    assert plan.rows == []
    assert csv_text == "Cannot export: 9 layers exceeds the PHPP U-Value maximum of 8 rows." + EOL


def test_inconsistent_split_profiles_yield_too_many_pathways() -> None:
    materials = {"pmat_x": _material("pmat_x", "Mat X", 0.5)}
    layer_a = AssemblyLayer(
        id="lyr_a",
        order=0,
        thickness_mm=20.0,
        segments=[_segment("seg_a0", 0, 850.0, "pmat_x"), _segment("seg_a1", 1, 150.0, "pmat_x")],
    )
    layer_b = AssemblyLayer(
        id="lyr_b",
        order=1,
        thickness_mm=20.0,
        segments=[_segment("seg_b0", 0, 500.0, "pmat_x"), _segment("seg_b1", 1, 500.0, "pmat_x")],
    )

    plan = build_assembly_export_plan(_assembly("Mismatched", [layer_a, layer_b]), materials)

    assert plan.reason == "too_many_pathways"


def test_four_segment_layer_yields_too_many_pathways() -> None:
    materials = {"pmat_x": _material("pmat_x", "Mat X", 0.5)}
    layer = AssemblyLayer(
        id="lyr_quad",
        order=0,
        thickness_mm=20.0,
        segments=[_segment(f"seg_{index}", index, 250.0, "pmat_x") for index in range(4)],
    )

    plan = build_assembly_export_plan(_assembly("Quad", [layer]), materials)

    assert plan.reason == "too_many_pathways"


def test_missing_material_yields_incomplete_materials_error() -> None:
    plan = build_assembly_export_plan(_assembly("No Mat", [_uniform_layer("lyr_0", 0, 20.0, None)]), {})

    assert plan.reason == "incomplete_materials"
    assert render_assembly_csv(plan) == "Cannot export: assembly has missing materials or conductivities." + EOL


def test_missing_conductivity_yields_incomplete_materials_error() -> None:
    materials = {"pmat_x": _material("pmat_x", "Mat X", None)}

    plan = build_assembly_export_plan(_assembly("No Cond", [_uniform_layer("lyr_0", 0, 20.0, "pmat_x")]), materials)

    assert plan.reason == "incomplete_materials"


# --- layer order, filenames, zip --------------------------------------------


def test_layers_ordered_exterior_to_interior_when_last_layer_outside() -> None:
    materials = {
        "pmat_out": _material("pmat_out", "Outer", 0.5),
        "pmat_in": _material("pmat_in", "Inner", 0.5),
    }
    assembly = _assembly(
        "Reversed",
        [
            _uniform_layer("lyr_inner", 0, 20.0, "pmat_in"),
            _uniform_layer("lyr_outer", 1, 20.0, "pmat_out"),
        ],
        orientation="last_layer_outside",
    )

    plan = build_assembly_export_plan(assembly, materials)

    # last_layer_outside ⇒ the highest-order layer is the outermost (top) row.
    assert [row.sections[0].material_name for row in plan.rows] == ["Outer", "Inner"]


def test_sanitize_csv_filename_edge_cases() -> None:
    assert sanitize_csv_filename("W-CS (Crawlspace)") == "W-CS (Crawlspace).csv"
    assert sanitize_csv_filename('W/CS:a*b?"x"<y>|z') == "W CS a b x y z.csv"
    assert sanitize_csv_filename("  trailing  whitespace  ") == "trailing whitespace.csv"
    assert sanitize_csv_filename("   ") == "assembly.csv"
    assert sanitize_csv_filename("x" * 200) == "x" * 120 + ".csv"


def test_build_phpp_zip_dedupes_colliding_filenames() -> None:
    """Distinct names that sanitize to the same stem get a numeric suffix."""
    body = _body_with_assemblies(
        [
            _assembly("W/CS", [_uniform_layer("lyr_0", 0, 20.0, "pmat_x")]),
            _assembly("W CS", [_uniform_layer("lyr_0", 0, 20.0, "pmat_x")]),
        ],
        materials=[_material("pmat_x", "Mat X", 0.5)],
    )

    archive = zipfile.ZipFile(io.BytesIO(build_phpp_zip(body)))

    assert archive.namelist() == ["W CS.csv", "W CS (2).csv"]


def test_build_phpp_zip_emits_one_entry_per_assembly_including_errors() -> None:
    body = _body_with_assemblies(
        [
            _assembly("Good", [_uniform_layer("lyr_0", 0, 20.0, "pmat_x")]),
            _assembly("Bad", [_uniform_layer("lyr_0", 0, 20.0, None)]),
        ],
        materials=[_material("pmat_x", "Mat X", 0.5)],
    )

    archive = zipfile.ZipFile(io.BytesIO(build_phpp_zip(body)))

    assert sorted(archive.namelist()) == ["Bad.csv", "Good.csv"]
    assert archive.read("Bad.csv").decode().startswith("Cannot export:")


def _body_with_assemblies(assemblies: list[Assembly], *, materials: list[ProjectMaterial]) -> ProjectDocumentV1:
    """A minimal saved-document body carrying the given assemblies/materials.

    The two source assemblies share an id (``asm_test``); the document model
    requires unique ids, so they are re-stamped here before validation.
    """
    raw = base_document().model_dump(mode="json")
    raw["tables"]["project_materials"] = [material.model_dump(mode="json") for material in materials]
    raw["tables"]["assemblies"] = [
        {**assembly.model_dump(mode="json"), "id": f"asm_{index}"} for index, assembly in enumerate(assemblies)
    ]
    return ProjectDocumentV1.model_validate(raw)
