# -*- Python Version: 3.11 -*-

"""
Thermal resistance calculations using the Passive House method.

The Passive House method averages ASHRAE's Parallel-Path and
Isothermal-Planes methods from Chapter 27 of the ASHRAE Handbook
of Fundamentals.

Reference: ASHRAE Handbook - Fundamentals, Chapter 27:
           Heat, Air, and Moisture Control in Building Assemblies

Methods:
    - Parallel-Path: Assumes heat flows through separate parallel paths,
      each with its own resistance. Good for similar conductivities.
    - Isothermal-Planes: Assumes temperature is uniform across each plane
      perpendicular to heat flow. Good for moderately different conductivities.
    - Passive House: Averages both methods for a balanced estimate.

Note: Surface film resistances (inside/outside air films) are NOT included
      in these calculations per the requirements.
"""

import logging
from dataclasses import dataclass
from itertools import product

from db_entities.assembly import Assembly, Layer

logger = logging.getLogger(__name__)


@dataclass
class ThermalResistanceResult:
    """Result of thermal resistance calculation for an assembly.

    All R-values are in SI units: m2-K/W
    U-value is in SI units: W/m2-K
    """

    r_parallel_path_si: float
    r_isothermal_planes_si: float
    r_effective_si: float
    u_effective_si: float
    is_valid: bool
    warnings: list[str]


def calculate_effective_r_value(assembly: Assembly) -> ThermalResistanceResult:
    """
    Calculate the effective R-value of an assembly using the Passive House method.

    The Passive House method averages two ASHRAE methods:
        R_effective = (R_parallel_path + R_isothermal_planes) / 2

    Args:
        assembly: The Assembly entity with layers and segments loaded

    Returns:
        ThermalResistanceResult with R-values in SI units (m2-K/W)

    Reference:
        ASHRAE Handbook - Fundamentals, Chapter 27
    """
    logger.info(f"calculate_effective_r_value(assembly={assembly.id}, name={assembly.name})")

    # Validate inputs
    warnings = _validate_assembly(assembly)
    if warnings:
        return _invalid_result(warnings)

    # Calculate using both methods
    r_parallel = _calculate_parallel_path_r_value(assembly.layers)
    r_isothermal = _calculate_isothermal_planes_r_value(assembly.layers)

    # Average the two methods (Passive House approach)
    r_effective = (r_parallel + r_isothermal) / 2.0

    # Calculate U-value (inverse of R-value)
    u_effective = 1.0 / r_effective if r_effective > 0 else 0.0

    logger.info(
        f"Thermal resistance calculated: R_parallel={r_parallel:.4f}, "
        f"R_isothermal={r_isothermal:.4f}, R_effective={r_effective:.4f} m2-K/W"
    )

    return ThermalResistanceResult(
        r_parallel_path_si=round(r_parallel, 6),
        r_isothermal_planes_si=round(r_isothermal, 6),
        r_effective_si=round(r_effective, 6),
        u_effective_si=round(u_effective, 6),
        is_valid=True,
        warnings=[],
    )


def _calculate_parallel_path_r_value(layers: list[Layer]) -> float:
    """
    PARALLEL-PATH METHOD (ASHRAE Chapter 27, Section 1.2)

    For assemblies with heterogeneous layers, this method calculates
    separate heat flow paths through each combination of materials,
    then weights them by their area fractions.

    Formula:
        U_assembly = SUM(area_fraction_i * U_path_i)
        R_assembly = 1 / U_assembly

    For a simple case with one heterogeneous layer (e.g., studs + insulation):
        U = f_studs * U_studs + f_insulation * U_insulation

    For multiple heterogeneous layers, all combinations of paths are computed.
    """
    # If all layers are single-segment (homogeneous), reduces to simple series sum
    if all(len(layer.segments) == 1 for layer in layers):
        return _sum_layer_r_values_simple(layers)

    # Generate all possible paths through the assembly
    # Each path is a tuple of segment indices for each layer
    segment_indices_per_layer = [range(len(layer.segments)) for layer in layers]
    all_paths = list(product(*segment_indices_per_layer))

    total_u = 0.0
    for path in all_paths:
        path_r = _calculate_path_r_value(layers, path)
        area_fraction = _calculate_path_area_fraction(layers, path)

        if path_r > 0:
            total_u += area_fraction / path_r

    return 1.0 / total_u if total_u > 0 else 0.0


def _calculate_isothermal_planes_r_value(layers: list[Layer]) -> float:
    """
    ISOTHERMAL-PLANES (SERIES) METHOD (ASHRAE Chapter 27, Section 1.2)

    Assumes temperature is uniform across each plane perpendicular to heat flow.
    For heterogeneous layers, calculates an area-weighted average R-value.

    Formula:
        For homogeneous layer: R_layer = thickness / conductivity
        For heterogeneous layer: R_layer = 1 / SUM(area_fraction_i / R_i)
        Total R = SUM(R_layer) for all layers in series
    """
    total_r = 0.0

    for layer in layers:
        thickness_m = layer.thickness_mm / 1000.0

        if len(layer.segments) == 1:
            # Homogeneous layer: R = d/k
            segment = layer.segments[0]
            conductivity = segment.material.conductivity_w_mk

            if conductivity and conductivity > 0:
                total_r += thickness_m / conductivity
        else:
            # Heterogeneous layer: area-weighted parallel combination
            total_width = sum(s.width_mm for s in layer.segments)
            sum_u_fraction = 0.0

            for segment in layer.segments:
                conductivity = segment.material.conductivity_w_mk

                if conductivity and conductivity > 0 and total_width > 0:
                    area_fraction = segment.width_mm / total_width
                    segment_r = thickness_m / conductivity
                    sum_u_fraction += area_fraction / segment_r

            if sum_u_fraction > 0:
                total_r += 1.0 / sum_u_fraction

    return total_r


def _sum_layer_r_values_simple(layers: list[Layer]) -> float:
    """Calculate total R-value for assembly with all single-segment layers (series only)."""
    total_r = 0.0

    for layer in layers:
        thickness_m = layer.thickness_mm / 1000.0
        conductivity = layer.segments[0].material.conductivity_w_mk

        if conductivity and conductivity > 0:
            total_r += thickness_m / conductivity

    return total_r


def _calculate_path_r_value(layers: list[Layer], path: tuple[int, ...]) -> float:
    """
    Calculate the total R-value along a specific path through the assembly.

    A path specifies which segment to use from each layer. The R-values
    are added in series along the path.
    """
    total_r = 0.0

    for layer, segment_idx in zip(layers, path):
        thickness_m = layer.thickness_mm / 1000.0
        segment = layer.segments[segment_idx]
        conductivity = segment.material.conductivity_w_mk

        if conductivity and conductivity > 0:
            total_r += thickness_m / conductivity

    return total_r


def _calculate_path_area_fraction(layers: list[Layer], path: tuple[int, ...]) -> float:
    """
    Calculate the area fraction for a specific path through the assembly.

    The area fraction of a path is the product of the area fractions
    of each segment along the path.
    """
    area_fraction = 1.0

    for layer, segment_idx in zip(layers, path):
        total_width = sum(s.width_mm for s in layer.segments)

        if total_width > 0:
            segment_width = layer.segments[segment_idx].width_mm
            area_fraction *= segment_width / total_width

    return area_fraction


def _validate_assembly(assembly: Assembly) -> list[str]:
    """Validate assembly data for thermal calculations."""
    warnings: list[str] = []

    if not assembly.layers:
        warnings.append("Assembly has no layers")
        return warnings

    for i, layer in enumerate(assembly.layers):
        layer_num = i + 1

        if layer.thickness_mm <= 0:
            warnings.append(f"Layer {layer_num} has zero or negative thickness")

        if not layer.segments:
            warnings.append(f"Layer {layer_num} has no segments")
            continue

        for j, segment in enumerate(layer.segments):
            segment_num = j + 1
            conductivity = segment.material.conductivity_w_mk if segment.material else None

            if not conductivity or conductivity <= 0:
                warnings.append(f"Layer {layer_num}, Segment {segment_num} has invalid conductivity")

            if segment.width_mm <= 0:
                warnings.append(f"Layer {layer_num}, Segment {segment_num} has zero or negative width")

    return warnings


def _invalid_result(warnings: list[str]) -> ThermalResistanceResult:
    """Return an invalid result with the given warnings."""
    return ThermalResistanceResult(
        r_parallel_path_si=0.0,
        r_isothermal_planes_si=0.0,
        r_effective_si=0.0,
        u_effective_si=0.0,
        is_valid=False,
        warnings=warnings,
    )
