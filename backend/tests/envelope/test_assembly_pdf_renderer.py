from __future__ import annotations

import pypdfium2 as pdfium
from reportlab.pdfbase import pdfmetrics

from features.envelope.assembly_pdf import (
    _FONT_NAME,
    LETTER_LANDSCAPE_PT,
    _centered_row_text_layout,
    render_assembly_report_pdf,
    render_renderer_proof,
)
from features.envelope.assembly_report import build_assembly_report
from features.project_document.document import Assembly, ProjectMaterial
from tests.envelope.test_envelope_document_contracts import assembly, project_material


def test_renderer_proof_is_deterministic_vector_pdf_with_selectable_text() -> None:
    first = render_renderer_proof()
    second = render_renderer_proof()

    assert first == second
    assert first.startswith(b"%PDF-")
    assert b"/FontFile2" in first
    assert b"/Subtype /Image" not in first

    document = pdfium.PdfDocument(first)
    assert len(document) == 1
    text_page = document[0].get_textpage()
    text = text_page.get_text_range()
    assert "Assembly renderer proof" in text
    assert "Exterior" in text
    assert "Interior" in text
    assert "Dense-pack cellulose" in text
    assert "Conductivity" in text


def test_report_pdf_is_deterministic_and_emits_one_vector_page_per_naturally_sorted_assembly() -> None:
    material = ProjectMaterial.model_validate(project_material())
    base = Assembly.model_validate(assembly())
    report = build_assembly_report(
        [
            base.model_copy(update={"id": "asm_10", "name": "Wall 10"}),
            base.model_copy(update={"id": "asm_2", "name": "Wall 2"}),
        ],
        [material],
        project_bt_number="2426",
        project_name="West Stockbridge House",
        version_name="Working",
        units="SI",
    )

    first = render_assembly_report_pdf(report)
    second = render_assembly_report_pdf(report)

    assert first == second
    assert b"/FontFile2" in first
    assert b"/Subtype /Image" not in first
    document = pdfium.PdfDocument(first)
    assert len(document) == 2
    first_text = document[0].get_textpage().get_text_range()
    second_text = document[1].get_textpage().get_text_range()
    assert "Wall 2 · Wall" in first_text
    assert "Wall 10 · Wall" in second_text
    assert "Wood fiber board" in first_text
    assert first_text.count("Wood fiber board") == 1
    assert "Needs review: missing material data" in first_text
    assert document[0].get_size() == LETTER_LANDSCAPE_PT
    assert document[0].render(scale=0.5).to_pil().getbbox() is not None


def test_report_pdf_fits_extreme_wide_and_deep_geometry_on_the_page() -> None:
    material = ProjectMaterial.model_validate(project_material(name="X" * 200))
    extreme = Assembly.model_validate(
        assembly(
            id="asm_extreme",
            name="Extreme geometry",
            layers=[
                {
                    "id": "lyr_deep",
                    "order": 0,
                    "thickness_mm": 10_000.0,
                    "segments": [
                        {
                            "id": "seg_wide",
                            "order": 0,
                            "width_mm": 100_000.0,
                            "is_continuous_insulation": False,
                            "steel_stud_spacing_mm": None,
                            "project_material_id": material.id,
                            "photo_asset_ids": [],
                            "photo_not_required": False,
                            "use_site_notes": None,
                        }
                    ],
                },
                {
                    "id": "lyr_thin",
                    "order": 1,
                    "thickness_mm": 0.01,
                    "segments": [
                        {
                            "id": "seg_thin",
                            "order": 0,
                            "width_mm": 100_000.0,
                            "is_continuous_insulation": False,
                            "steel_stud_spacing_mm": None,
                            "project_material_id": None,
                            "photo_asset_ids": [],
                            "photo_not_required": False,
                            "use_site_notes": None,
                        }
                    ],
                },
            ],
        )
    )
    report = build_assembly_report(
        [extreme],
        [material],
        project_bt_number="BT-EXTREME",
        project_name="Geometry QA",
        version_name="Saved",
        units="IP",
    )

    document = pdfium.PdfDocument(render_assembly_report_pdf(report))

    assert len(document) == 1
    assert document[0].get_size() == LETTER_LANDSCAPE_PT
    assert document[0].render(scale=0.5).to_pil().getbbox() is not None
    text = document[0].get_textpage().get_text_range()
    assert "Extreme geometry" in text
    assert "393.701 in" in text
    assert material.name in text
    assert "Needs review: missing material data" in text


def test_report_pdf_preserves_dense_material_tables_and_full_names() -> None:
    materials = [
        ProjectMaterial.model_validate(
            project_material(
                id=f"pmat_{index:03d}",
                name=f"Material {index:03d} " + "long identifying value " * 6,
                datasheet_asset_ids=[],
            )
        )
        for index in range(120)
    ]
    dense = Assembly.model_validate(
        assembly(
            id="asm_dense",
            name="Dense material table",
            layers=[
                {
                    "id": f"lyr_{index:03d}",
                    "order": index,
                    "thickness_mm": 10.0,
                    "segments": [
                        {
                            "id": f"seg_{index:03d}",
                            "order": 0,
                            "width_mm": 1000.0,
                            "is_continuous_insulation": False,
                            "steel_stud_spacing_mm": None,
                            "project_material_id": material.id,
                            "photo_asset_ids": [],
                            "photo_not_required": False,
                            "use_site_notes": None,
                        }
                    ],
                }
                for index, material in enumerate(materials)
            ],
        )
    )
    report = build_assembly_report(
        [dense],
        materials,
        project_bt_number="BT-DENSE",
        project_name="Material table QA",
        version_name="Saved",
        units="SI",
    )

    document = pdfium.PdfDocument(render_assembly_report_pdf(report))
    text = document[0].get_textpage().get_text_range()

    assert len(document) == 1
    assert document[0].render(scale=0.5).to_pil().getbbox() is not None
    assert all(material.name in text for material in materials)
    assert "..." not in text

    row_height = (476.0 - 90.0 - 25.0) / len(materials)
    row_bottom = 100.0
    font_size, baseline = _centered_row_text_layout(
        materials[0].name,
        font_name=_FONT_NAME,
        font_size=min(6.0, row_height * 0.55),
        max_width=76.0,
        row_bottom=row_bottom,
        row_height=row_height,
    )
    ascent, descent = pdfmetrics.getAscentDescent(_FONT_NAME, font_size)
    assert baseline + descent >= row_bottom
    assert baseline + ascent <= row_bottom + row_height


def test_report_projects_ordinary_air_barrier_and_renders_legacy_multi_segment_membrane() -> None:
    insulation = ProjectMaterial.model_validate(project_material())
    membrane = ProjectMaterial.model_validate(
        project_material(
            id="pmat_membrane",
            name="Smart membrane",
            category="membrane",
            color="#3a7bd5",
        )
    )
    raw = assembly()
    raw["air_barrier"] = {"layer_id": "lyr_sheathing", "face": "interior"}
    raw["layers"].insert(
        1,
        {
            "id": "lyr_membrane",
            "order": 1,
            "thickness_mm": 0.2,
            "segments": [
                {
                    "id": "seg_membrane_a",
                    "order": 0,
                    "width_mm": 400.0,
                    "is_continuous_insulation": False,
                    "steel_stud_spacing_mm": None,
                    "project_material_id": "pmat_membrane",
                    "photo_asset_ids": [],
                    "photo_not_required": False,
                    "use_site_notes": None,
                },
                {
                    "id": "seg_membrane_b",
                    "order": 1,
                    "width_mm": 412.8,
                    "is_continuous_insulation": False,
                    "steel_stud_spacing_mm": None,
                    "project_material_id": "pmat_membrane",
                    "photo_asset_ids": [],
                    "photo_not_required": False,
                    "use_site_notes": None,
                },
            ],
        },
    )
    raw["layers"][2]["order"] = 2
    report = build_assembly_report(
        [Assembly.model_validate(raw)],
        [insulation, membrane],
        project_bt_number="2426",
        project_name="Air barrier QA",
        version_name="Saved",
        units="SI",
    )

    page = report.pages[0]
    membrane_layer = next(layer for layer in page.layers if layer.layer_id == "lyr_membrane")
    document = pdfium.PdfDocument(render_assembly_report_pdf(report))

    assert page.air_barrier is not None
    assert page.air_barrier.layer_id == "lyr_sheathing"
    assert page.air_barrier.y_mm == 50.0
    assert len(membrane_layer.segments) == 2
    assert document[0].render(scale=0.5).to_pil().getbbox() is not None
