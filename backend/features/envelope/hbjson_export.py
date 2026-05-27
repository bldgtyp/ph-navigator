"""HBJSON construction export for saved Assembly Builder versions."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

from features.envelope.thermal import ThermalIssue, thermal_issues
from features.project_document.document import Assembly, AssemblyLayer, ProjectDocumentV1, ProjectMaterial
from features.shared.errors import api_error


def export_hbjson_constructions(body: ProjectDocumentV1) -> dict[str, object]:
    """Serialize saved assemblies as Honeybee-compatible opaque constructions."""
    materials_by_id = {material.id: material for material in body.tables.project_materials}
    errors = _export_errors(body.tables.assemblies, materials_by_id)
    if errors:
        raise api_error(
            422,
            "envelope_export_incomplete",
            "Envelope assemblies need complete material assignments and conductivity before HBJSON export.",
            {"errors": errors},
        )

    identifiers = _unique_assembly_identifiers(body.tables.assemblies)
    return {
        "type": "PHNavigatorOpaqueConstructionLibrary",
        "schema_version": body.schema_version,
        "ph_nav": {"export_type": "envelope_constructions", "project_material_ids_are_stable": True},
        "constructions": {
            identifiers[assembly.id]: _construction_payload(identifiers[assembly.id], assembly, materials_by_id)
            for assembly in body.tables.assemblies
        },
    }


def _construction_payload(
    identifier: str,
    assembly: Assembly,
    materials_by_id: dict[str, ProjectMaterial],
) -> dict[str, object]:
    return {
        "type": "OpaqueConstruction",
        "identifier": identifier,
        "display_name": assembly.name,
        "properties": {"type": "OpaqueConstructionProperties", "ph": {"type": "OpaqueConstructionPhProperties"}},
        "materials": [_layer_material_payload(layer, materials_by_id) for layer in _layers_outside_to_inside(assembly)],
    }


def _layer_material_payload(
    layer: AssemblyLayer,
    materials_by_id: dict[str, ProjectMaterial],
) -> dict[str, object]:
    if len(layer.segments) == 1:
        segment = layer.segments[0]
        material = materials_by_id[segment.project_material_id or ""]
        return _energy_material_payload(
            _material_identifier(material, layer.thickness_mm),
            material,
            layer.thickness_mm,
        )

    segments = sorted(layer.segments, key=lambda segment: segment.order)
    child_materials = []
    equivalent_conductivity = 0.0
    total_width = sum(segment.width_mm for segment in segments)
    for segment in segments:
        material = materials_by_id[segment.project_material_id or ""]
        child_materials.append(
            {
                "column_width": segment.width_mm / 1000.0,
                "row_height": 1.0,
                "material": _energy_material_payload(
                    _material_identifier(material, layer.thickness_mm),
                    material,
                    layer.thickness_mm,
                ),
                "ph_nav": {"segment_id": segment.id},
            }
        )
        equivalent_conductivity += (segment.width_mm / total_width) * (material.conductivity_w_mk or 0.0)

    first_material = materials_by_id[segments[0].project_material_id or ""]
    payload = _energy_material_payload(
        _clean_identifier(f"Hybrid {layer.id}"),
        first_material,
        layer.thickness_mm,
        conductivity=equivalent_conductivity,
    )
    payload["display_name"] = " + ".join(
        dict.fromkeys(materials_by_id[segment.project_material_id or ""].name for segment in segments)
    )
    payload["properties"]["ph"]["divisions"] = {
        "row_heights": [1.0],
        "column_widths": [segment.width_mm / 1000.0 for segment in segments],
        "is_a_steel_stud_cavity": any(segment.steel_stud_spacing_mm is not None for segment in segments),
        "steel_stud_spacing_mm": next(
            (segment.steel_stud_spacing_mm for segment in segments if segment.steel_stud_spacing_mm is not None),
            None,
        ),
        "cells": child_materials,
    }
    return payload


def _energy_material_payload(
    identifier: str,
    material: ProjectMaterial,
    thickness_mm: float,
    *,
    conductivity: float | None = None,
) -> dict[str, Any]:
    return {
        "type": "EnergyMaterial",
        "identifier": identifier,
        "display_name": material.name,
        "thickness": thickness_mm / 1000.0,
        "conductivity": conductivity if conductivity is not None else material.conductivity_w_mk,
        "density": material.density_kg_m3,
        "specific_heat": material.specific_heat_j_kgk,
        "thermal_absorptance": material.emissivity,
        "solar_absorptance": material.emissivity,
        "visible_absorptance": material.emissivity,
        "roughness": "MediumRough",
        "properties": {
            "type": "EnergyMaterialProperties",
            "ph": {
                "user_data": {},
                "ph_color": material.argb_color,
            },
            "ref": {
                "type": "EnergyMaterialRefProperties",
                "external_identifiers": {"ph_nav": material.id},
                "ref_status": material.specification_status,
                "document_refs": [{"asset_id": asset_id} for asset_id in material.datasheet_asset_ids],
            },
        },
        "ph_nav": {
            "project_material_id": material.id,
            "catalog_origin": material.catalog_origin.model_dump(mode="json") if material.catalog_origin else None,
        },
    }


def _export_errors(
    assemblies: list[Assembly],
    materials_by_id: dict[str, ProjectMaterial],
) -> list[dict[str, object]]:
    return [
        _error_entry(issue)
        for assembly in assemblies
        for issue in thermal_issues(assembly, materials_by_id)
    ]


def _error_entry(issue: ThermalIssue) -> dict[str, object]:
    path = f"tables.assemblies[{issue.assembly_id}].layers[{issue.layer_id}]"
    if issue.segment_id is not None:
        path = f"{path}.segments[{issue.segment_id}]"
    return {
        "code": issue.code,
        "path": path,
        "assembly_id": issue.assembly_id,
        "assembly_name": issue.assembly_name,
        "layer_id": issue.layer_id,
        "layer_order": issue.layer_order,
        "segment_id": issue.segment_id,
        "segment_order": issue.segment_order,
    }


def _layers_outside_to_inside(assembly: Assembly) -> list[AssemblyLayer]:
    layers = sorted(assembly.layers, key=lambda layer: layer.order)
    if assembly.orientation == "last_layer_outside":
        return list(reversed(layers))
    return layers


def _unique_assembly_identifiers(assemblies: list[Assembly]) -> dict[str, str]:
    bases = [_clean_identifier(assembly.name) for assembly in assemblies]
    counts = Counter(bases)
    identifiers: dict[str, str] = {}
    for assembly, base in zip(assemblies, bases, strict=True):
        identifiers[assembly.id] = f"{base}_{assembly.id}" if counts[base] > 1 else base
    return identifiers


def _material_identifier(material: ProjectMaterial, thickness_mm: float) -> str:
    return _clean_identifier(f"{material.name} {material.id} {thickness_mm / 25.4:.1f}in")


def _clean_identifier(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_]+", "_", value.strip())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "unnamed"
