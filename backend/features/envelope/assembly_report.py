"""Canonical Assembly report projection shared by PDF composition tests."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Sequence
from decimal import ROUND_HALF_UP, Decimal
from functools import cmp_to_key

from pydantic import BaseModel, ConfigDict

from features.envelope.membranes import is_membrane_layer
from features.envelope.phpp_types import UnitSystem
from features.project_document.document import Assembly, AssemblyLayer, ProjectMaterial

MEMBRANE_BAND_HEIGHT_MM = 9.0
_DIGIT_RUN = re.compile(r"([0-9]+)")
_R_PER_IN_PER_W_MK = 1 / (0.577789317 * 12)
_LB_FT3_PER_KG_M3 = 0.06242796
_BTU_LB_F_PER_J_KG_K = 0.0002388458966275


class AssemblyReportSegment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    segment_id: str
    x_mm: float
    y_mm: float
    width_mm: float
    height_mm: float
    project_material_id: str | None
    material_name: str | None
    color: str
    is_missing_material: bool
    is_air_barrier: bool


class AssemblyReportLayer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    layer_id: str
    order: int
    y_mm: float
    height_mm: float
    thickness_mm: float
    thickness_label: str | None
    is_membrane: bool
    segments: list[AssemblyReportSegment]


class AssemblyReportMaterial(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_material_id: str
    name: str
    color: str
    value_label: str
    density_label: str
    specific_heat_label: str
    emissivity_label: str


class AssemblyReportAirBarrier(BaseModel):
    model_config = ConfigDict(extra="forbid")

    layer_id: str
    face: str
    y_mm: float
    width_mm: float


class AssemblyReportPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assembly_id: str
    name: str
    assembly_type: str
    orientation_top: str
    orientation_bottom: str
    width_mm: float
    height_mm: float
    needs_review_missing_material_data: bool
    air_barrier: AssemblyReportAirBarrier | None
    layers: list[AssemblyReportLayer]
    materials: list[AssemblyReportMaterial]


class AssemblyReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_bt_number: str
    project_name: str
    version_name: str
    units: UnitSystem
    pages: list[AssemblyReportPage]


def build_assembly_report(
    assemblies: Sequence[Assembly],
    materials: Sequence[ProjectMaterial],
    *,
    project_bt_number: str,
    project_name: str,
    version_name: str,
    units: UnitSystem,
) -> AssemblyReport:
    materials_by_id = {material.id: material for material in materials}
    return AssemblyReport(
        project_bt_number=project_bt_number,
        project_name=project_name,
        version_name=version_name,
        units=units,
        pages=[
            _build_assembly_report_page(item, materials_by_id, units=units)
            for item in natural_sort_assemblies(assemblies)
        ],
    )


def build_assembly_report_page(
    assembly: Assembly,
    materials: Sequence[ProjectMaterial],
    *,
    units: UnitSystem,
) -> AssemblyReportPage:
    materials_by_id = {material.id: material for material in materials}
    return _build_assembly_report_page(assembly, materials_by_id, units=units)


def _build_assembly_report_page(
    assembly: Assembly,
    materials_by_id: dict[str, ProjectMaterial],
    *,
    units: UnitSystem,
) -> AssemblyReportPage:
    ordered_layers = sorted(assembly.layers, key=lambda layer: layer.order)
    membrane_by_layer_id = {layer.id: is_membrane_layer(layer, materials_by_id) for layer in ordered_layers}
    width_mm = _assembly_width_mm(ordered_layers, membrane_by_layer_id)
    report_layers: list[AssemblyReportLayer] = []
    used_materials: list[ProjectMaterial] = []
    seen_material_ids: set[str] = set()
    missing_material = False
    y_mm = 0.0

    for layer in ordered_layers:
        is_membrane = membrane_by_layer_id[layer.id]
        height_mm = MEMBRANE_BAND_HEIGHT_MM if is_membrane else layer.thickness_mm
        source_width_mm = sum(segment.width_mm for segment in layer.segments)
        membrane_scale = width_mm / source_width_mm if is_membrane else 1.0
        x_mm = 0.0
        report_segments: list[AssemblyReportSegment] = []
        for segment in sorted(layer.segments, key=lambda item: item.order):
            material = materials_by_id.get(segment.project_material_id or "")
            is_missing = material is None
            missing_material = missing_material or is_missing
            if material is not None and material.id not in seen_material_ids:
                seen_material_ids.add(material.id)
                used_materials.append(material)
            segment_width_mm = segment.width_mm * membrane_scale
            report_segments.append(
                AssemblyReportSegment(
                    segment_id=segment.id,
                    x_mm=x_mm,
                    y_mm=y_mm,
                    width_mm=segment_width_mm,
                    height_mm=height_mm,
                    project_material_id=segment.project_material_id,
                    material_name=material.name if material else None,
                    color=material.color if material and material.color else "transparent",
                    is_missing_material=is_missing,
                    is_air_barrier=(
                        is_membrane and assembly.air_barrier is not None and assembly.air_barrier.layer_id == layer.id
                    ),
                )
            )
            x_mm += segment_width_mm
        report_layers.append(
            AssemblyReportLayer(
                layer_id=layer.id,
                order=layer.order,
                y_mm=y_mm,
                height_mm=height_mm,
                thickness_mm=layer.thickness_mm,
                thickness_label=None if is_membrane else _format_length(layer.thickness_mm, units),
                is_membrane=is_membrane,
                segments=report_segments,
            )
        )
        y_mm += height_mm

    exterior_at_top = assembly.orientation == "first_layer_outside"
    return AssemblyReportPage(
        assembly_id=assembly.id,
        name=assembly.name,
        assembly_type=assembly.type,
        orientation_top="Exterior" if exterior_at_top else "Interior",
        orientation_bottom="Interior" if exterior_at_top else "Exterior",
        width_mm=width_mm,
        height_mm=max(1.0, y_mm),
        needs_review_missing_material_data=(
            missing_material or any(material.conductivity_w_mk is None for material in used_materials)
        ),
        air_barrier=_air_barrier_geometry(assembly, report_layers, width_mm),
        layers=report_layers,
        materials=[_material_row(material, units) for material in used_materials],
    )


def natural_sort_assemblies(assemblies: Sequence[Assembly]) -> list[Assembly]:
    decorated = [(assembly, _natural_parts(assembly.name)) for assembly in assemblies]
    ordered = sorted(decorated, key=cmp_to_key(_compare_decorated_assemblies))
    return [assembly for assembly, _ in ordered]


def _compare_decorated_assemblies(
    left: tuple[Assembly, list[str]],
    right: tuple[Assembly, list[str]],
) -> int:
    compared = _compare_natural_parts(left[1], right[1])
    return compared if compared else _compare_code_points(left[0].id, right[0].id)


def _compare_natural_parts(left_parts: list[str], right_parts: list[str]) -> int:
    for left_part, right_part in zip(left_parts, right_parts, strict=False):
        left_is_digit = left_part.isascii() and left_part.isdigit()
        right_is_digit = right_part.isascii() and right_part.isdigit()
        if left_is_digit and right_is_digit:
            compared = _compare_numbers(left_part, right_part)
        elif left_is_digit != right_is_digit:
            compared = 1 if left_is_digit else -1
        else:
            compared = _compare_code_points(left_part, right_part)
        if compared:
            return compared
    return (len(left_parts) > len(right_parts)) - (len(left_parts) < len(right_parts))


def _natural_parts(value: str) -> list[str]:
    normalized = unicodedata.normalize("NFKD", value).lower()
    return [part for part in _DIGIT_RUN.split(normalized) if part]


def _compare_numbers(left: str, right: str) -> int:
    normalized_left = left.lstrip("0") or "0"
    normalized_right = right.lstrip("0") or "0"
    if len(normalized_left) != len(normalized_right):
        return (len(normalized_left) > len(normalized_right)) - (len(normalized_left) < len(normalized_right))
    return _compare_code_points(normalized_left, normalized_right)


def _compare_code_points(left: str, right: str) -> int:
    return (left > right) - (left < right)


def _assembly_width_mm(layers: Sequence[AssemblyLayer], membrane_by_layer_id: dict[str, bool]) -> float:
    content_widths = [
        sum(segment.width_mm for segment in layer.segments) for layer in layers if not membrane_by_layer_id[layer.id]
    ]
    candidates = content_widths or [sum(segment.width_mm for segment in layer.segments) for layer in layers]
    return max(1.0, *candidates)


def _air_barrier_geometry(
    assembly: Assembly,
    layers: Sequence[AssemblyReportLayer],
    width_mm: float,
) -> AssemblyReportAirBarrier | None:
    designation = assembly.air_barrier
    if designation is None:
        return None
    target = next((layer for layer in layers if layer.layer_id == designation.layer_id), None)
    if target is None or target.is_membrane:
        return None
    exterior_is_below = assembly.orientation == "last_layer_outside"
    at_layer_bottom = designation.face == ("exterior" if exterior_is_below else "interior")
    return AssemblyReportAirBarrier(
        layer_id=designation.layer_id,
        face=designation.face,
        y_mm=target.y_mm + target.height_mm if at_layer_bottom else target.y_mm,
        width_mm=width_mm,
    )


def _material_row(material: ProjectMaterial, units: UnitSystem) -> AssemblyReportMaterial:
    if units == "IP":
        value = None if material.conductivity_w_mk is None else _R_PER_IN_PER_W_MK / material.conductivity_w_mk
        density = None if material.density_kg_m3 is None else material.density_kg_m3 * _LB_FT3_PER_KG_M3
        specific_heat = (
            None if material.specific_heat_j_kgk is None else material.specific_heat_j_kgk * _BTU_LB_F_PER_J_KG_K
        )
        density_digits, specific_heat_digits = 1, 3
    else:
        value = material.conductivity_w_mk
        density = material.density_kg_m3
        specific_heat = material.specific_heat_j_kgk
        density_digits, specific_heat_digits = 1, 0
    return AssemblyReportMaterial(
        project_material_id=material.id,
        name=material.name,
        color=material.color or "transparent",
        value_label=_format_number(value, 3),
        density_label=_format_number(density, density_digits),
        specific_heat_label=_format_number(specific_heat, specific_heat_digits),
        emissivity_label=_format_number(material.emissivity, 3),
    )


def _format_length(value_mm: float, units: UnitSystem) -> str:
    return _format_number(value_mm / 25.4, 3) if units == "IP" else _format_number(value_mm, 1)


def _format_number(value: float | None, digits: int) -> str:
    if value is None:
        return "—"
    quantum = Decimal(1).scaleb(-digits)
    rounded = Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP)
    formatted = f"{rounded:,.{digits}f}"
    return formatted.rstrip("0").rstrip(".") if "." in formatted else formatted
