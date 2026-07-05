"""Rich opaque-construction HBJSON export for the Grasshopper Data API.

Unlike `features/envelope/hbjson_export.py` (a hand-rolled dict shaped for the
web download), this builds **real honeybee `OpaqueConstruction` objects** with
`honeybee_energy_ph` (PhColor, division grid) and `honeybee_energy_ref`
(datasheet/photo refs, `ph_nav` external ids) properties, then `.to_dict()`s
them — so `OpaqueConstruction.from_dict` round-trips identically in Rhino
(decision D5). It mirrors the V1 `to_hbe_material_typical` / `to_hbe_construction`
serialization, sourced from the V2 document model.

Payload: `{assembly.name: OpaqueConstruction.to_dict()}`, single-encoded.

Parity notes (see PRD §7):
- Hybrid (multi-segment) layers and steel-stud segments both flow through
  `PhDivisionGrid.get_equivalent_conductivity()` — V2's segment-based model has
  no V1-style assembly-level AISI split; the grid is the shared mechanism.
- The hybrid material keeps the base material's density / specific-heat and
  replaces only conductivity (documented V1 limitation — do NOT "improve").
- Asset references emit a **stable `phn-asset:<id>` locator** (decision O1),
  never a short-lived signed URL.
"""

from __future__ import annotations

from typing import Any

from honeybee.typing import clean_and_id_ep_string, clean_ep_string
from honeybee_energy.construction.opaque import OpaqueConstruction
from honeybee_energy.material.opaque import EnergyMaterial
from honeybee_energy_ph.properties.materials.opaque import PhColor, PhDivisionGrid
from honeybee_energy_ref.document_ref import DocumentReference
from honeybee_energy_ref.image_ref import ImageReference
from starlette import status

from features.assets.base import asset_locator
from features.gh_api.export_helpers import reject_duplicate_names
from features.project_document.document import ProjectDocumentV1
from features.project_document.envelope_models import Assembly, AssemblyLayer, AssemblySegment, ProjectMaterial
from features.shared.errors import api_error

__all__ = ["export_rich_constructions"]

_INCHES_PER_METER = 39.3701


def export_rich_constructions(body: ProjectDocumentV1) -> dict[str, dict[str, Any]]:
    """Serialize every assembly as a rich `OpaqueConstruction.to_dict()`, keyed by name."""
    reject_duplicate_names(
        (assembly.name for assembly in body.tables.assemblies),
        error_code="duplicate_assembly_names",
        message="Assemblies have duplicate names; rename them so each is unique before exporting to Grasshopper.",
    )
    materials = {material.id: material for material in body.tables.project_materials}
    return {assembly.name: _construction(assembly, materials).to_dict() for assembly in body.tables.assemblies}


def _construction(assembly: Assembly, materials: dict[str, ProjectMaterial]) -> OpaqueConstruction:
    layer_materials = [_layer_material(layer, assembly, materials) for layer in assembly.layers_outside_to_inside()]
    return OpaqueConstruction(clean_ep_string(assembly.name), layer_materials)


def _layer_material(layer: AssemblyLayer, assembly: Assembly, materials: dict[str, ProjectMaterial]) -> EnergyMaterial:
    thickness_m = layer.thickness_mm / 1000.0
    segments = sorted(layer.segments, key=lambda segment: segment.order)
    if len(segments) == 1:
        return _segment_material(segments[0], thickness_m, assembly, materials)
    return _hybrid_material(segments, thickness_m, assembly, materials)


def _segment_material(
    segment: AssemblySegment,
    thickness_m: float,
    assembly: Assembly,
    materials: dict[str, ProjectMaterial],
) -> EnergyMaterial:
    material = _require_material(segment, assembly, materials)
    hb_material = EnergyMaterial(
        identifier=f"{clean_ep_string(material.name)} [{thickness_m * _INCHES_PER_METER:.1f} in]",
        thickness=thickness_m,
        conductivity=material.conductivity_w_mk,
        density=material.density_kg_m3,
        specific_heat=material.specific_heat_j_kgk,
    )
    _apply_ph_color(hb_material, material.color)
    _apply_references(hb_material, material, segment)
    return hb_material


def _hybrid_material(
    segments: list[AssemblySegment],
    thickness_m: float,
    assembly: Assembly,
    materials: dict[str, ProjectMaterial],
) -> EnergyMaterial:
    grid = PhDivisionGrid()
    grid.set_row_heights([1.0])
    grid.set_column_widths([segment.width_mm / 1000.0 for segment in segments])
    steel_stud_spacing_mm = next(
        (segment.steel_stud_spacing_mm for segment in segments if segment.steel_stud_spacing_mm is not None),
        None,
    )
    if steel_stud_spacing_mm is not None:
        grid.steel_stud_spacing_mm = steel_stud_spacing_mm
    for column, segment in enumerate(segments):
        grid.set_cell_material(column, 0, _segment_material(segment, thickness_m, assembly, materials))

    base_material = grid.get_base_material()
    hybrid = base_material.duplicate()
    hybrid.identifier = clean_and_id_ep_string("HybridEnergyMaterial")
    hybrid.display_name = _hybrid_display_name(segments, materials)
    # V1 parity: replace ONLY conductivity with the grid's equivalent value;
    # density and specific-heat stay the base material's (documented limitation).
    hybrid.conductivity = grid.get_equivalent_conductivity()
    hybrid.properties.ph.divisions = grid
    hybrid.properties.ph.ph_color = base_material.properties.ph.ph_color
    return hybrid


def _hybrid_display_name(segments: list[AssemblySegment], materials: dict[str, ProjectMaterial]) -> str:
    names = [
        (material.name if (material := materials.get(segment.project_material_id or "")) is not None else "Unassigned")
        for segment in segments
    ]
    return " + ".join(dict.fromkeys(names))


def _apply_ph_color(hb_material: EnergyMaterial, hex_color: str | None) -> None:
    color = _ph_color(hex_color)
    if color is not None:
        hb_material.properties.ph.ph_color = color


def _apply_references(hb_material: EnergyMaterial, material: ProjectMaterial, segment: AssemblySegment) -> None:
    ref = hb_material.properties.ref
    ref.unlock()
    for asset_id in material.datasheet_asset_ids:
        locator = asset_locator(asset_id)
        ref.add_document_ref(
            DocumentReference(document_uri=locator, thumbnail_image_uri=locator, full_size_image_uri=locator)
        )
    for asset_id in segment.photo_asset_ids:
        locator = asset_locator(asset_id)
        ref.add_image_ref(ImageReference(thumbnail_image_uri=locator, full_size_image_uri=locator))
    ref.add_external_identifier("ph_nav", material.id)
    ref.ref_status = material.specification_status
    ref.lock()


def _ph_color(hex_color: str | None) -> PhColor | None:
    if not hex_color:
        return None
    cleaned = hex_color.lstrip("#")
    if len(cleaned) != 6:
        return None
    try:
        red, green, blue = (int(cleaned[i : i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return None
    return PhColor.from_rgb(red, green, blue)


def _require_material(
    segment: AssemblySegment, assembly: Assembly, materials: dict[str, ProjectMaterial]
) -> ProjectMaterial:
    material = materials.get(segment.project_material_id or "")
    missing_fields: list[str] = []
    if material is not None:
        missing_fields = [
            field
            for field, value in (
                ("conductivity_w_mk", material.conductivity_w_mk),
                ("density_kg_m3", material.density_kg_m3),
                ("specific_heat_j_kgk", material.specific_heat_j_kgk),
            )
            if value is None
        ]
    if material is None or missing_fields:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "construction_export_incomplete",
            "An assembly references a material that is missing thermal properties.",
            {
                "assembly": assembly.name,
                "segment_id": segment.id,
                "project_material_id": segment.project_material_id,
                "missing": missing_fields or ["material"],
            },
        )
    return material
