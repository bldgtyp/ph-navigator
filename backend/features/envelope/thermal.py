"""Construction-only thermal calculations for Assembly Builder."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from itertools import product

from features.envelope.membranes import assigned_materials, is_membrane_layer, is_membrane_material
from features.envelope.models import AssemblyThermalStatus, ThermalStatusFlag
from features.project_document.document import Assembly, AssemblyLayer, AssemblySegment, ProjectMaterial


@dataclass(frozen=True)
class ThermalResult:
    status: AssemblyThermalStatus
    input_hash: str
    r_parallel_path_m2k_w: float | None
    r_isothermal_planes_m2k_w: float | None
    r_effective_m2k_w: float | None
    u_effective_w_m2k: float | None
    warnings: list[str]


@dataclass(frozen=True)
class ThermalIssue:
    code: ThermalStatusFlag
    assembly_id: str
    assembly_name: str
    layer_id: str
    layer_order: int
    segment_id: str | None = None
    segment_order: int | None = None


def calculate_assembly_thermal(
    assembly: Assembly,
    materials_by_id: dict[str, ProjectMaterial],
) -> ThermalResult:
    """Return SI-canonical preview values or explicit incomplete-state flags.

    This is a construction-only Passive House preview, not certification
    output. It reports the PH average of ASHRAE Fundamentals Ch. 25
    Parallel-Path and Isothermal-Planes methods after guarding missing
    materials, missing conductivity, broken references, and bad geometry.

    Membrane layers take no part in it at all — see ``is_membrane_layer``.
    """
    issues = thermal_issues(assembly, materials_by_id)
    flags = thermal_issue_flags(issues)
    blocking_flags = {
        "missing_conductivity",
        "invalid_geometry",
        "broken_material_reference",
        "no_thermal_layers",
    }
    input_hash = thermal_input_hash(assembly, materials_by_id)
    warnings = thermal_warning_messages(flags)
    if flags.intersection(blocking_flags) or all(
        segment.project_material_id is None for layer in assembly.layers for segment in layer.segments
    ):
        return ThermalResult(
            status=thermal_status_from_issues(issues),
            input_hash=input_hash,
            r_parallel_path_m2k_w=None,
            r_isothermal_planes_m2k_w=None,
            r_effective_m2k_w=None,
            u_effective_w_m2k=None,
            warnings=warnings,
        )

    r_parallel = _calculate_parallel_path_r_value(assembly, materials_by_id)
    r_isothermal = _calculate_isothermal_planes_r_value(assembly, materials_by_id)
    if r_parallel <= 0 or r_isothermal <= 0:
        flags.add("invalid_geometry")
        return ThermalResult(
            status=AssemblyThermalStatus(is_complete=False, flags=sorted(flags)),
            input_hash=input_hash,
            r_parallel_path_m2k_w=None,
            r_isothermal_planes_m2k_w=None,
            r_effective_m2k_w=None,
            u_effective_w_m2k=None,
            warnings=[*warnings, "Thermal resistance could not be calculated from the assigned segments."],
        )

    r_effective = (r_parallel + r_isothermal) / 2.0
    return ThermalResult(
        status=thermal_status_from_issues(issues),
        input_hash=input_hash,
        r_parallel_path_m2k_w=round(r_parallel, 6),
        r_isothermal_planes_m2k_w=round(r_isothermal, 6),
        r_effective_m2k_w=round(r_effective, 6),
        u_effective_w_m2k=round(1.0 / r_effective, 6),
        warnings=warnings,
    )


def thermal_input_hash(assembly: Assembly, materials_by_id: dict[str, ProjectMaterial]) -> str:
    """Hash only the assembly subtree and referenced physical material fields."""
    material_refs: dict[str, dict[str, object]] = {}
    for layer in assembly.layers:
        for segment in layer.segments:
            if segment.project_material_id is None or segment.project_material_id in material_refs:
                continue
            material = materials_by_id.get(segment.project_material_id)
            material_refs[segment.project_material_id] = (
                {
                    "id": material.id,
                    # `category` is a thermal input now: it is what makes a
                    # layer a membrane and therefore excluded from the R sum.
                    "category": material.category,
                    "conductivity_w_mk": material.conductivity_w_mk,
                    "density_kg_m3": material.density_kg_m3,
                    "specific_heat_j_kgk": material.specific_heat_j_kgk,
                    "emissivity": material.emissivity,
                }
                if material is not None
                else {"id": segment.project_material_id, "missing": True}
            )
    payload = {
        "assembly": assembly.model_dump(mode="json"),
        "materials": material_refs,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def _calculate_parallel_path_r_value(
    assembly: Assembly,
    materials_by_id: dict[str, ProjectMaterial],
) -> float:
    """Apply the ASHRAE Ch. 25 Parallel-Path method across layer segment paths.

    Single-segment layers collapse to simple series R-values. Zero-width
    or invalid segments are filtered before path generation, and the
    final `total_u > 0` guard prevents a divide-by-zero preview result.
    """
    layer_paths = [_layer_path_segments(layer, materials_by_id) for layer in assembly.layers]
    layer_paths = [paths for paths in layer_paths if paths]
    if all(len(paths) == 1 for paths in layer_paths):
        return sum(paths[0].r_value for paths in layer_paths)

    total_u = 0.0
    for path in product(*layer_paths):
        path_r = sum(segment.r_value for segment in path)
        area_fraction = 1.0
        for segment in path:
            area_fraction *= segment.area_fraction
        if path_r > 0:
            total_u += area_fraction / path_r
    return 1.0 / total_u if total_u > 0 else 0.0


def _calculate_isothermal_planes_r_value(
    assembly: Assembly,
    materials_by_id: dict[str, ProjectMaterial],
) -> float:
    """Apply the Isothermal-Planes method used in PH envelope previews.

    Each layer is reduced to an equivalent R-value from valid segment
    width fractions, with a single-segment fast path and a positive-U
    guard so incomplete geometry yields no contribution instead of an
    invalid certification-looking result.
    """
    total_r = 0.0
    for layer in assembly.layers:
        valid_segments = _valid_segments(layer, materials_by_id)
        if len(valid_segments) == 1:
            total_r += _segment_r_value(layer, valid_segments[0], materials_by_id)
            continue

        total_width = sum(segment.width_mm for segment in valid_segments)
        sum_u_fraction = 0.0
        for segment in valid_segments:
            segment_r = _segment_r_value(layer, segment, materials_by_id)
            if segment_r > 0:
                sum_u_fraction += (segment.width_mm / total_width) / segment_r
        if sum_u_fraction > 0:
            total_r += 1.0 / sum_u_fraction
    return total_r


def _segment_r_value(
    layer: AssemblyLayer,
    segment: AssemblySegment,
    materials_by_id: dict[str, ProjectMaterial],
) -> float:
    material = materials_by_id[segment.project_material_id or ""]
    return (layer.thickness_mm / 1000.0) / (material.conductivity_w_mk or 0.0)


def _valid_segments(
    layer: AssemblyLayer,
    materials_by_id: dict[str, ProjectMaterial],
) -> list[AssemblySegment]:
    """Segments that contribute an R-value: assigned, conductive, non-membrane.

    Membrane layers contribute nothing at all — not a near-zero R, but no
    entry in the series/parallel sums. See ``membranes.is_membrane_layer``.
    One pass over the layer serves both questions, so a layer's materials
    are resolved once rather than once per predicate.
    """
    assigned = assigned_materials(layer, materials_by_id)
    if assigned and all(is_membrane_material(material) for _, material in assigned):
        return []
    return [
        segment
        for segment, material in assigned
        if material.conductivity_w_mk is not None and material.conductivity_w_mk > 0
    ]


@dataclass(frozen=True)
class _LayerPathSegment:
    r_value: float
    area_fraction: float


def _layer_path_segments(
    layer: AssemblyLayer,
    materials_by_id: dict[str, ProjectMaterial],
) -> list[_LayerPathSegment]:
    valid_segments = _valid_segments(layer, materials_by_id)
    total_width = sum(segment.width_mm for segment in valid_segments)
    if total_width <= 0:
        return []
    return [
        _LayerPathSegment(
            r_value=_segment_r_value(layer, segment, materials_by_id),
            area_fraction=segment.width_mm / total_width,
        )
        for segment in valid_segments
    ]


def thermal_issues(
    assembly: Assembly,
    materials_by_id: dict[str, ProjectMaterial],
) -> list[ThermalIssue]:
    issues: list[ThermalIssue] = []
    thermal_layers = 0
    for layer_index, layer in enumerate(assembly.layers):
        is_membrane = is_membrane_layer(layer, materials_by_id)
        if not is_membrane:
            thermal_layers += 1
        if layer.thickness_mm <= 0:
            issues.append(_thermal_issue("invalid_geometry", assembly, layer_index, layer))
        for segment_index, segment in enumerate(layer.segments):
            if segment.width_mm <= 0 or (
                segment.steel_stud_spacing_mm is not None and segment.steel_stud_spacing_mm <= 0
            ):
                issues.append(_thermal_issue("invalid_geometry", assembly, layer_index, layer, segment_index, segment))
            if segment.project_material_id is None:
                issues.append(_thermal_issue("missing_material", assembly, layer_index, layer, segment_index, segment))
                continue
            material = materials_by_id.get(segment.project_material_id)
            if material is None:
                issues.append(
                    _thermal_issue("broken_material_reference", assembly, layer_index, layer, segment_index, segment)
                )
            elif is_membrane:
                # Membranes need no conductivity: they never enter the R sum.
                continue
            elif material.conductivity_w_mk is None or material.conductivity_w_mk <= 0:
                issues.append(
                    _thermal_issue("missing_conductivity", assembly, layer_index, layer, segment_index, segment)
                )
    if assembly.layers and thermal_layers == 0:
        # Every layer is a membrane, so there is nothing to build an R-value
        # from. Say so explicitly rather than reporting bad geometry.
        issues.append(_thermal_issue("no_thermal_layers", assembly, 0, assembly.layers[0]))
    return issues


def _thermal_issue(
    code: ThermalStatusFlag,
    assembly: Assembly,
    layer_index: int,
    layer: AssemblyLayer,
    segment_index: int | None = None,
    segment: AssemblySegment | None = None,
) -> ThermalIssue:
    return ThermalIssue(
        code=code,
        assembly_id=assembly.id,
        assembly_name=assembly.name,
        layer_id=layer.id,
        layer_order=layer_index,
        segment_id=segment.id if segment is not None else None,
        segment_order=segment_index,
    )


def thermal_issue_flags(issues: list[ThermalIssue]) -> set[ThermalStatusFlag]:
    return {issue.code for issue in issues}


def thermal_status_from_issues(issues: list[ThermalIssue]) -> AssemblyThermalStatus:
    flags = sorted(thermal_issue_flags(issues))
    return AssemblyThermalStatus(is_complete=not flags, flags=flags)


def thermal_warning_messages(flags: set[ThermalStatusFlag]) -> list[str]:
    messages = {
        "missing_material": "One or more segments do not have a material assignment.",
        "missing_conductivity": "One or more assigned materials need conductivity before export.",
        "invalid_geometry": "Layer thickness, segment width, or steel-stud spacing is invalid.",
        "broken_material_reference": "One or more segments reference a missing project material.",
        "no_thermal_layers": (
            "Every layer is a membrane, which carries no thermal resistance, so there is no U-value to report."
        ),
    }
    return [messages[flag] for flag in sorted(flags)]
