"""Construction-detail Phase 1: the deduplicated `constructions` map.

The fixture model is synthesized from the honeybee / honeybee-ph API (no
committed HBJSON — heavy/licensed exports stay out of this public repo)
and covers the three construction kinds the feature must carry:

- flat: homogeneous honeybee layers, empty `divisions`;
- hybrid: a framed honeybee-ph layer with N division cells
  (insulation ↔ stud stripes), each cell nesting its own material;
- steel-stud: a single-cell framed layer with `steel_stud_spacing_mm`.

The model is serialized to HBJSON and re-parsed through `parse_hb_model`
so the assertions exercise the *full model* path (PRD §11 risk), not just
isolated construction round-trips.
"""

from __future__ import annotations

from typing import Any

import pytest
from honeybee.model import Model
from honeybee.room import Room
from honeybee_energy.construction.opaque import OpaqueConstruction
from honeybee_energy.material.opaque import EnergyMaterial
from honeybee_ph_utils.color import PhColor

from features.model_viewer.extraction import extract_model_data, parse_hb_model
from features.model_viewer.schemas.combined import CombinedModelDataSchema
from features.model_viewer.schemas.honeybee_energy import FaceConstructionSummarySchema

STEEL_STUD_SPACING_MM = 406.4


def _material(
    identifier: str,
    thickness: float,
    conductivity: float,
    color: tuple[int, int, int] | None,
) -> EnergyMaterial:
    material = EnergyMaterial(identifier, thickness, conductivity, 450.0, 1200.0)
    if color is not None:
        material.properties.ph.ph_color = PhColor.from_argb(255, *color)
    return material


def _framed_material(
    identifier: str,
    thickness: float,
    column_widths: list[float],
    cell_materials: list[EnergyMaterial],
    steel_stud_spacing_mm: float | None = None,
) -> EnergyMaterial:
    """A honeybee-ph 'hybrid' layer: division cells across one row."""
    material = _material(identifier, thickness, 0.05, None)
    divisions = material.properties.ph.divisions
    divisions.set_row_heights([1.0])
    divisions.set_column_widths(column_widths)
    for column, cell_material in enumerate(cell_materials):
        divisions.set_cell_material(column, 0, cell_material)
    if steel_stud_spacing_mm is not None:
        divisions.steel_stud_spacing_mm = steel_stud_spacing_mm
    return material


def _synthetic_model() -> Model:
    """One box room; walls share the hybrid construction (dedup case)."""
    cellulose = _material("Cellulose", 0.14, 0.04, (200, 180, 140))
    wood_stud = _material("Wood Stud", 0.14, 0.12, (120, 80, 40))
    gypsum = _material("Gypsum Board", 0.0127, 0.25, (240, 240, 230))
    xps = _material("XPS", 0.1, 0.029, (150, 200, 220))

    flat = OpaqueConstruction("Flat Floor", [xps, gypsum])
    hybrid = OpaqueConstruction(
        "Hybrid Wall",
        [
            xps,
            _framed_material("Cellulose+Stud Cavity", 0.14, [0.4, 0.038, 0.4], [cellulose, wood_stud, cellulose]),
            gypsum,
        ],
    )
    steel_stud = OpaqueConstruction(
        "Steel Stud Roof",
        [
            xps,
            _framed_material(
                "Steel Stud Cavity", 0.089, [1.0], [cellulose], steel_stud_spacing_mm=STEEL_STUD_SPACING_MM
            ),
        ],
    )

    room = Room.from_box("Test-Room", 4.0, 4.0, 3.0)
    constructions_by_type = {"Wall": hybrid, "RoofCeiling": steel_stud, "Floor": flat}
    for face in room.faces:
        face.properties.energy.construction = constructions_by_type[str(face.type)]
    return Model("Constructions-Fixture", rooms=[room])


@pytest.fixture(scope="module")
def extracted() -> CombinedModelDataSchema:
    """Serialize → re-parse → extract: the real artifact path end-to-end."""
    hbjson: dict[str, Any] = _synthetic_model().to_dict()
    return extract_model_data(parse_hb_model(hbjson))


def test_constructions_map_dedups_by_identifier(extracted: CombinedModelDataSchema) -> None:
    """4 walls + 1 roof + 1 floor → exactly 3 unique constructions."""
    assert extracted.load_summary.faces_extracted == 6
    assert set(extracted.constructions) == {"Flat Floor", "Hybrid Wall", "Steel Stud Roof"}


def test_faces_carry_thin_summary_keyed_into_map(extracted: CombinedModelDataSchema) -> None:
    """D-2: per-face construction is the summary — no materials on faces."""
    for face in extracted.faces:
        summary = face.properties.energy.construction
        assert type(summary) is FaceConstructionSummarySchema  # exact: not the Detailed subclass
        assert not hasattr(summary, "materials")
        detailed = extracted.constructions[summary.identifier]
        assert summary.type == detailed.type
        assert summary.u_factor == detailed.u_factor > 0
        assert summary.r_value == detailed.r_value > 0


def test_flat_layers_have_empty_divisions(extracted: CombinedModelDataSchema) -> None:
    flat = extracted.constructions["Flat Floor"]
    assert [m.identifier for m in flat.materials] == ["XPS", "Gypsum Board"]
    for material in flat.materials:
        assert material.properties is not None
        assert material.properties.ph is not None
        assert material.properties.ph.divisions.cells == []
        assert material.properties.ph.divisions.column_widths == []
        color = material.properties.ph.ph_color
        assert color is not None and color.a == 255


def test_hybrid_layer_preserves_cells_and_colors(extracted: CombinedModelDataSchema) -> None:
    hybrid = extracted.constructions["Hybrid Wall"]
    framed = hybrid.materials[1]
    assert framed.identifier == "Cellulose+Stud Cavity"
    assert framed.properties is not None and framed.properties.ph is not None
    divisions = framed.properties.ph.divisions
    assert divisions.column_widths == [0.4, 0.038, 0.4]
    assert [cell.material.identifier for cell in divisions.cells] == ["Cellulose", "Wood Stud", "Cellulose"]
    for cell in divisions.cells:
        assert cell.material.conductivity > 0
        assert cell.material.thickness > 0
        assert cell.material.properties is not None and cell.material.properties.ph is not None
        assert cell.material.properties.ph.ph_color is not None


def test_steel_stud_layer_preserves_spacing(extracted: CombinedModelDataSchema) -> None:
    steel = extracted.constructions["Steel Stud Roof"]
    framed = steel.materials[1]
    assert framed.properties is not None and framed.properties.ph is not None
    divisions = framed.properties.ph.divisions
    assert divisions.steel_stud_spacing_mm == pytest.approx(STEEL_STUD_SPACING_MM)
    assert len(divisions.cells) == 1


def test_materials_ordered_exterior_to_interior(extracted: CombinedModelDataSchema) -> None:
    """Q1: honeybee materials[] is outside → inside; XPS is the exterior
    layer in every fixture construction."""
    for construction in extracted.constructions.values():
        assert construction.materials[0].identifier == "XPS"
