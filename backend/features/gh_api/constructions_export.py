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

from dataclasses import dataclass, field
from typing import Any, Literal

from fastapi import HTTPException
from honeybee.typing import clean_and_id_ep_string, clean_ep_string
from honeybee_energy.construction.opaque import OpaqueConstruction
from honeybee_energy.material.opaque import EnergyMaterial
from honeybee_energy_ph.properties.materials.opaque import PhColor, PhDivisionGrid
from honeybee_energy_ref.document_ref import DocumentReference
from honeybee_energy_ref.image_ref import ImageReference
from starlette import status

from features.assets.base import asset_locator
from features.envelope.honeybee_specification_status import to_external_ref_status
from features.gh_api.export_helpers import reject_duplicate_names
from features.gh_api.models import GhWarning
from features.project_document.document import ProjectDocumentV1
from features.project_document.envelope_models import Assembly, AssemblyLayer, AssemblySegment, ProjectMaterial
from features.shared.errors import api_error

__all__ = ["OnMissingThermal", "export_rich_constructions"]

_INCHES_PER_METER = 39.3701

# `on_missing_thermal` route modes (README: gh-material-thermal-defaults).
# `strict` (default) 422s on any missing conductivity/density/specific-heat.
# `user_defaults` fills the two thermal-MASS fields with PH-neutral placeholders
# and warns, but still 422s on missing conductivity (it drives the U-value).
OnMissingThermal = Literal["strict", "user_defaults"]

# Thermal-MASS fields that `user_defaults` may fill, each mapped to its
# PH-neutral, EnergyPlus-safe default and human label (Ed, 2026-07-05). These
# affect only dynamic thermal-mass sims, never the steady-state PH U-value.
# Single-sourced here so adding a defaultable field touches exactly one place.
_THERMAL_MASS_DEFAULTS: dict[str, tuple[float, str]] = {
    "density_kg_m3": (600.0, "density"),
    "specific_heat_j_kgk": (1000.0, "specific heat"),
}


@dataclass
class _ExportContext:
    """Per-export state threaded through the recursion: the material lookup, the
    missing-thermal mode, and the running list of substitution warnings."""

    materials: dict[str, ProjectMaterial]
    on_missing_thermal: OnMissingThermal
    warnings: list[GhWarning] = field(default_factory=list)


def export_rich_constructions(
    body: ProjectDocumentV1, on_missing_thermal: OnMissingThermal = "strict"
) -> tuple[dict[str, dict[str, Any]], list[GhWarning]]:
    """Serialize every assembly as a rich `OpaqueConstruction.to_dict()`, keyed by name.

    Returns the constructions plus any `warnings` accumulated while filling
    thermal-mass defaults (empty under `strict`, the default mode).
    """
    reject_duplicate_names(
        (assembly.name for assembly in body.tables.assemblies),
        error_code="duplicate_assembly_names",
        message="Assemblies have duplicate names; rename them so each is unique before exporting to Grasshopper.",
    )
    ctx = _ExportContext(
        materials={material.id: material for material in body.tables.project_materials},
        on_missing_thermal=on_missing_thermal,
    )
    constructions = {assembly.name: _construction(assembly, ctx).to_dict() for assembly in body.tables.assemblies}
    return constructions, ctx.warnings


def _construction(assembly: Assembly, ctx: _ExportContext) -> OpaqueConstruction:
    layer_materials = [_layer_material(layer, assembly, ctx) for layer in assembly.layers_outside_to_inside()]
    return OpaqueConstruction(clean_ep_string(assembly.name), layer_materials)


def _layer_material(layer: AssemblyLayer, assembly: Assembly, ctx: _ExportContext) -> EnergyMaterial:
    thickness_m = layer.thickness_mm / 1000.0
    segments = sorted(layer.segments, key=lambda segment: segment.order)
    if len(segments) == 1:
        return _segment_material(segments[0], thickness_m, assembly, ctx)
    return _hybrid_material(segments, thickness_m, assembly, ctx)


def _segment_material(
    segment: AssemblySegment,
    thickness_m: float,
    assembly: Assembly,
    ctx: _ExportContext,
) -> EnergyMaterial:
    material = _require_material(segment, assembly, ctx)
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
    ctx: _ExportContext,
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
        grid.set_cell_material(column, 0, _segment_material(segment, thickness_m, assembly, ctx))

    base_material = grid.get_base_material()
    hybrid = base_material.duplicate()
    hybrid.identifier = clean_and_id_ep_string("HybridEnergyMaterial")
    hybrid.display_name = _hybrid_display_name(segments, ctx.materials)
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
    ref.ref_status = to_external_ref_status(material.specification_status)
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


def _require_material(segment: AssemblySegment, assembly: Assembly, ctx: _ExportContext) -> ProjectMaterial:
    """Resolve a segment's material, enforcing/relaxing thermal completeness per mode.

    `strict` 422s if any of conductivity/density/specific-heat is missing.
    `user_defaults` fills missing density/specific-heat with PH-neutral defaults
    (recording a warning) but still 422s on missing conductivity — it drives the
    U-value, so a wrong default would silently corrupt the PH result.
    """
    material = ctx.materials.get(segment.project_material_id or "")
    if material is None:
        raise _incomplete_error(assembly, segment, ["material"])

    if ctx.on_missing_thermal == "strict":
        missing = [
            field
            for field, value in (
                ("conductivity_w_mk", material.conductivity_w_mk),
                ("density_kg_m3", material.density_kg_m3),
                ("specific_heat_j_kgk", material.specific_heat_j_kgk),
            )
            if value is None
        ]
        if missing:
            raise _incomplete_error(assembly, segment, missing)
        return material

    if material.conductivity_w_mk is None:
        raise _incomplete_error(assembly, segment, ["conductivity_w_mk"])
    return _fill_thermal_defaults(material, assembly, segment, ctx)


def _fill_thermal_defaults(
    material: ProjectMaterial, assembly: Assembly, segment: AssemblySegment, ctx: _ExportContext
) -> ProjectMaterial:
    """Substitute PH-neutral defaults for any missing thermal-mass field; warn once."""
    updates = {
        field: default
        for field, (default, _label) in _THERMAL_MASS_DEFAULTS.items()
        if getattr(material, field) is None
    }
    if not updates:
        return material

    ctx.warnings.append(
        GhWarning(
            code="material_thermal_defaulted",
            message=_defaulted_message(updates),
            details={
                "assembly": assembly.name,
                "segment_id": segment.id,
                "project_material_id": material.id,
                "defaulted_fields": list(updates),
            },
        )
    )
    return material.model_copy(update=updates)


def _defaulted_message(defaulted_fields: dict[str, float]) -> str:
    parts = [f"{_THERMAL_MASS_DEFAULTS[field][1]} ({_THERMAL_MASS_DEFAULTS[field][0]:g})" for field in defaulted_fields]
    return f"Used default {' and '.join(parts)} — thermal-mass only; no effect on PH U-value."


def _incomplete_error(assembly: Assembly, segment: AssemblySegment, missing: list[str]) -> HTTPException:
    return api_error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "construction_export_incomplete",
        "An assembly references a material that is missing thermal properties.",
        {
            "assembly": assembly.name,
            "segment_id": segment.id,
            "project_material_id": segment.project_material_id,
            "missing": missing,
        },
    )
