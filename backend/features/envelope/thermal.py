"""Thermal calculations for Assembly Builder.

Two R-values live side by side here, and conflating them is the failure
mode this module is shaped to prevent:

* **construction-only** (``r_construction_m2k_w``) — the bare material
  layers. This is what PHPP's U-Values worksheet wants, because that
  worksheet adds its own surface films from its own assembly-type setting.
* **effective** (``r_effective_m2k_w`` / ``u_effective_w_m2k``) — the
  construction plus the ISO 6946 surface films. This is the real U-factor
  and what the Assembly Builder header reports.

Sending the effective number to PHPP would double-count the films; that
is guarded by an explicit regression test in ``test_phpp_export.py``.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from itertools import product

from features.envelope.boundary_conditions import HeatFlowDirection, resolve_surface_resistances
from features.envelope.models import AssemblyThermalStatus, ThermalStatusFlag
from features.project_document.document import (
    Assembly,
    AssemblyLayer,
    AssemblySegment,
    ProjectMaterial,
    ThermalStandard,
)


@dataclass(frozen=True)
class ConstructionThermalResult:
    """The bare material stack. Has no film or effective field, by design.

    Handing this type to a film-free consumer is what keeps the PHPP
    double-count impossible rather than merely tested: there is no
    ``u_effective_w_m2k`` on it to reach for.
    """

    status: AssemblyThermalStatus
    r_parallel_path_m2k_w: float | None
    r_isothermal_planes_m2k_w: float | None
    r_construction_m2k_w: float | None
    u_construction_w_m2k: float | None
    warnings: list[str]


@dataclass(frozen=True)
class ThermalResult:
    status: AssemblyThermalStatus
    input_hash: str
    r_parallel_path_m2k_w: float | None
    r_isothermal_planes_m2k_w: float | None
    r_construction_m2k_w: float | None
    u_construction_w_m2k: float | None
    r_effective_m2k_w: float | None
    u_effective_w_m2k: float | None
    # Always populated — the films depend only on the assembly's type and
    # exterior condition, so they are known even when missing materials
    # leave every R/U field null.
    rsi_m2k_w: float
    rse_m2k_w: float
    heat_flow_direction: HeatFlowDirection
    thermal_standard: ThermalStandard
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


def calculate_construction_thermal(
    assembly: Assembly,
    materials_by_id: dict[str, ProjectMaterial],
) -> ConstructionThermalResult:
    """Resolve the bare material stack, with no surface films anywhere.

    The PH average of the ASHRAE Fundamentals Ch. 25 Parallel-Path and
    Isothermal-Planes methods, guarded against missing materials, missing
    conductivity, broken references, and bad geometry.

    Consumers that must not see films — the PHPP U-Values export, whose
    worksheet supplies its own — call this rather than
    :func:`calculate_assembly_thermal`, so picking the wrong convention
    is not something a caller can do by reaching for the wrong field.
    """
    issues = thermal_issues(assembly, materials_by_id)
    flags = thermal_issue_flags(issues)
    blocking_flags = {"missing_conductivity", "invalid_geometry", "broken_material_reference"}
    warnings = thermal_warning_messages(flags)
    if flags.intersection(blocking_flags) or all(
        segment.project_material_id is None for layer in assembly.layers for segment in layer.segments
    ):
        return _incomplete_construction(thermal_status_from_issues(issues), warnings)

    r_parallel = _calculate_parallel_path_r_value(assembly, materials_by_id)
    r_isothermal = _calculate_isothermal_planes_r_value(assembly, materials_by_id)
    if r_parallel <= 0 or r_isothermal <= 0:
        flags.add("invalid_geometry")
        return _incomplete_construction(
            AssemblyThermalStatus(is_complete=False, flags=sorted(flags)),
            [*warnings, "Thermal resistance could not be calculated from the assigned segments."],
        )

    r_construction = (r_parallel + r_isothermal) / 2.0
    return ConstructionThermalResult(
        status=thermal_status_from_issues(issues),
        r_parallel_path_m2k_w=round(r_parallel, 6),
        r_isothermal_planes_m2k_w=round(r_isothermal, 6),
        r_construction_m2k_w=round(r_construction, 6),
        u_construction_w_m2k=round(1.0 / r_construction, 6),
        warnings=warnings,
    )


def calculate_assembly_thermal(
    assembly: Assembly,
    materials_by_id: dict[str, ProjectMaterial],
    standard: ThermalStandard = "iso_6946",
) -> ThermalResult:
    """Return SI-canonical preview values or explicit incomplete-state flags.

    This is a Passive House preview, not certification output. The surface
    films are added **in series with the construction average** — per
    ISO 13788's `R_total = Rsi + ΣR + Rse` — rather than inside each
    parallel path, so the two bracketing method values stay comparable and
    construction-only.
    """
    construction = calculate_construction_thermal(assembly, materials_by_id)
    films = resolve_surface_resistances(assembly.type, assembly.exterior_condition, standard)
    r_construction = construction.r_construction_m2k_w
    r_effective = None if r_construction is None else films.rsi_m2k_w + r_construction + films.rse_m2k_w
    return ThermalResult(
        status=construction.status,
        input_hash=thermal_input_hash(assembly, materials_by_id, standard),
        r_parallel_path_m2k_w=construction.r_parallel_path_m2k_w,
        r_isothermal_planes_m2k_w=construction.r_isothermal_planes_m2k_w,
        r_construction_m2k_w=r_construction,
        u_construction_w_m2k=construction.u_construction_w_m2k,
        r_effective_m2k_w=None if r_effective is None else round(r_effective, 6),
        u_effective_w_m2k=None if r_effective is None else round(1.0 / r_effective, 6),
        rsi_m2k_w=films.rsi_m2k_w,
        rse_m2k_w=films.rse_m2k_w,
        heat_flow_direction=films.heat_flow_direction,
        thermal_standard=films.standard,
        warnings=construction.warnings,
    )


def _incomplete_construction(status: AssemblyThermalStatus, warnings: list[str]) -> ConstructionThermalResult:
    """Null every R/U field; the caller still reports the always-known films."""
    return ConstructionThermalResult(
        status=status,
        r_parallel_path_m2k_w=None,
        r_isothermal_planes_m2k_w=None,
        r_construction_m2k_w=None,
        u_construction_w_m2k=None,
        warnings=warnings,
    )


def thermal_input_hash(
    assembly: Assembly,
    materials_by_id: dict[str, ProjectMaterial],
    standard: ThermalStandard = "iso_6946",
) -> str:
    """Hash the assembly subtree, referenced material physics, and the standard.

    The standard is an input to the surface films, so a project that
    switches it must invalidate every cached preview — the assembly
    subtree alone would not change.
    """
    material_refs: dict[str, dict[str, object]] = {}
    for layer in assembly.layers:
        for segment in layer.segments:
            if segment.project_material_id is None or segment.project_material_id in material_refs:
                continue
            material = materials_by_id.get(segment.project_material_id)
            material_refs[segment.project_material_id] = (
                {
                    "id": material.id,
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
        "thermal_standard": standard,
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
    return [
        segment
        for segment in layer.segments
        if segment.project_material_id is not None
        and (material := materials_by_id.get(segment.project_material_id)) is not None
        and material.conductivity_w_mk is not None
        and material.conductivity_w_mk > 0
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
    for layer_index, layer in enumerate(assembly.layers):
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
            elif material.conductivity_w_mk is None or material.conductivity_w_mk <= 0:
                issues.append(
                    _thermal_issue("missing_conductivity", assembly, layer_index, layer, segment_index, segment)
                )
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
    }
    return [messages[flag] for flag in sorted(flags)]
