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

Steel Stud Handling:
    For assemblies with steel studs, the stud cavity layer uses an equivalent
    conductivity calculated using AISI S250-21 methodology to account for
    thermal bridging through the steel framing.
"""

import logging
from dataclasses import dataclass
from itertools import product

from db_entities.assembly import Assembly, Layer, Segment
from honeybee_ph_utils.aisi_s250_21 import (
    STEEL_CONDUCTIVITY,
    StudSpacingInches,
    StudThicknessMil,
    calculate_stud_cavity_effective_u_value,
)
from ph_units.converter import convert

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


def _calculate_steel_stud_equivalent_conductivity(assembly: Assembly) -> float:
    """
    Calculate equivalent conductivity for a steel stud cavity layer.

    Uses AISI S250-21 methodology to account for thermal bridging through
    steel framing. Surface film resistances are excluded (R_SE=0, R_SI=0)
    to match the R-value calculation requirements.

    Args:
        assembly: The Assembly with steel stud layers

    Returns:
        Equivalent conductivity in W/m-K

    Note:
        Uses hardcoded assumptions for stud parameters:
        - Stud spacing: 16 inches (406.4mm)
        - Stud thickness: 43 mil
        - Stud flange width: 1.625 inches
    """
    # Sort layers into groups based on their position relative to the steel stud cavity
    layer_groups = _sort_layers_for_steel_stud_calc(assembly.layers_outside_to_inside)

    # Calculate R-values for each group in IP units (hr-ft2-F/Btu)
    r_ext_cladding_IP = _calc_layer_group_r_value_IP(layer_groups["ext_cladding"])
    r_ext_insulation_IP = _calc_layer_group_r_value_IP(layer_groups["ext_insulation"])
    r_ext_sheathing_IP = _calc_layer_group_r_value_IP(layer_groups["ext_sheathing"])
    r_int_sheathing_IP = _calc_layer_group_r_value_IP(layer_groups["int_sheathing"])

    # Get the stud cavity layer properties
    stud_cavity_layer = layer_groups["stud_cavity"]
    if not stud_cavity_layer:
        raise ValueError("No steel stud cavity layer found in assembly")

    stud_depth_m = stud_cavity_layer.thickness_mm / 1000.0
    stud_depth_inch = convert(stud_depth_m, "M", "INCH") or 0.0

    # Get cavity insulation R-value
    cavity_segment = stud_cavity_layer.segments[0]
    cavity_conductivity = cavity_segment.material.conductivity_w_mk
    if not cavity_conductivity or cavity_conductivity <= 0:
        raise ValueError("Invalid cavity insulation conductivity")
    r_cavity_SI = stud_depth_m / cavity_conductivity
    r_cavity_IP = convert(r_cavity_SI, "M2-K/W", "HR-FT2-F/BTU") or 0.0

    # Calculate using AISI S250-21, with R_SE=0 and R_SI=0 to exclude surface films
    STUD_FLANGE_WIDTH_INCH = 1.625
    u_IP = calculate_stud_cavity_effective_u_value(
        _r_ext_cladding=r_ext_cladding_IP,
        _r_ext_insulation=r_ext_insulation_IP,
        _r_ext_sheathing=r_ext_sheathing_IP,
        _r_cavity_insulation=r_cavity_IP,
        _stud_spacing_inch=StudSpacingInches("16"),
        _stud_thickness_mil=StudThicknessMil("43"),
        _stud_flange_width_inch=STUD_FLANGE_WIDTH_INCH,
        _stud_depth_inch=stud_depth_inch,
        _steel_conductivity=STEEL_CONDUCTIVITY[StudThicknessMil("43")],
        _r_int_sheathing=r_int_sheathing_IP,
        _r_se=0.0,  # Exclude surface film
        _r_si=0.0,  # Exclude surface film
    )

    u_SI = convert(u_IP, "BTU/HR-FT2-F", "W/M2-K")
    if not u_SI:
        raise ValueError(f"Failed to convert U-value: {u_IP} from IP to SI units.")

    return u_SI * stud_depth_m


def _sort_layers_for_steel_stud_calc(layers: list[Layer]) -> dict:
    """
    Sort layers into groups for steel stud calculation.

    Groups:
    - ext_cladding: Exterior cladding layers (before CI)
    - ext_insulation: Continuous insulation layers
    - ext_sheathing: Exterior sheathing layers (between CI and cavity)
    - stud_cavity: The steel stud cavity layer
    - int_sheathing: Interior sheathing layers (after cavity)
    """
    groups: dict = {
        "ext_cladding": [],
        "ext_insulation": [],
        "ext_sheathing": [],
        "stud_cavity": None,
        "int_sheathing": [],
    }

    # Find the steel stud layer index
    stud_cavity_idx = None
    for i, layer in enumerate(layers):
        if layer.is_steel_stud_layer:
            stud_cavity_idx = i
            groups["stud_cavity"] = layer
            break

    if stud_cavity_idx is None:
        return groups

    # Sort exterior layers (before the stud cavity)
    ext_layers = layers[:stud_cavity_idx]
    found_ci = False
    for layer in ext_layers:
        if layer.is_continuous_insulation_layer:
            groups["ext_insulation"].append(layer)
            found_ci = True
        elif not found_ci:
            groups["ext_cladding"].append(layer)
        else:
            groups["ext_sheathing"].append(layer)

    # Interior layers (after the stud cavity)
    groups["int_sheathing"] = layers[stud_cavity_idx + 1 :]

    return groups


def _calc_layer_group_r_value_IP(layers: list[Layer]) -> float:
    """
    Calculate total R-value for a group of layers in IP units (hr-ft2-F/Btu).
    """
    total_r_SI = 0.0

    for layer in layers:
        thickness_m = layer.thickness_mm / 1000.0
        # Use first segment conductivity (assumes homogeneous non-cavity layers)
        if layer.segments:
            conductivity = layer.segments[0].material.conductivity_w_mk
            if conductivity and conductivity > 0:
                total_r_SI += thickness_m / conductivity

    return convert(total_r_SI, "M2-K/W", "HR-FT2-F/BTU") or 0.0


def _get_effective_conductivity(
    segment: Segment,
    assembly: Assembly,
    steel_stud_eq_conductivity: float | None,
) -> float:
    """
    Get the effective conductivity for a segment.

    For steel stud segments, returns the pre-calculated equivalent conductivity
    that accounts for thermal bridging. For other segments, returns the raw
    material conductivity.

    Args:
        segment: The segment to get conductivity for
        assembly: The full assembly (for context)
        steel_stud_eq_conductivity: Pre-calculated equivalent conductivity for
            steel stud layers (None if assembly has no steel studs)

    Returns:
        Conductivity in W/m-K
    """
    if (
        segment.steel_stud_spacing_mm is not None
        and steel_stud_eq_conductivity is not None
    ):
        return steel_stud_eq_conductivity

    return segment.material.conductivity_w_mk


def calculate_effective_r_value(assembly: Assembly) -> ThermalResistanceResult:
    """
    Calculate the effective R-value of an assembly using the Passive House method.

    The Passive House method averages two ASHRAE methods:
        R_effective = (R_parallel_path + R_isothermal_planes) / 2

    For assemblies with steel studs, the stud cavity layer uses an equivalent
    conductivity calculated using AISI S250-21 to account for thermal bridging.

    Args:
        assembly: The Assembly entity with layers and segments loaded

    Returns:
        ThermalResistanceResult with R-values in SI units (m2-K/W)

    Reference:
        ASHRAE Handbook - Fundamentals, Chapter 27
        AISI S250-21 (for steel stud thermal bridging)
    """
    logger.info(
        f"calculate_effective_r_value(assembly={assembly.id}, name={assembly.name})"
    )

    # Validate inputs
    warnings = _validate_assembly(assembly)
    if warnings:
        return _invalid_result(warnings)

    # Calculate steel stud equivalent conductivity if applicable
    steel_stud_eq_conductivity: float | None = None
    if assembly.is_steel_stud_assembly:
        logger.info("Assembly has steel studs - calculating equivalent conductivity")
        steel_stud_eq_conductivity = _calculate_steel_stud_equivalent_conductivity(
            assembly
        )
        logger.info(
            f"Steel stud equivalent conductivity: {steel_stud_eq_conductivity:.6f} W/m-K"
        )

    # Calculate using both methods
    r_parallel = _calculate_parallel_path_r_value(assembly, steel_stud_eq_conductivity)
    r_isothermal = _calculate_isothermal_planes_r_value(
        assembly, steel_stud_eq_conductivity
    )

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


def _calculate_parallel_path_r_value(
    assembly: Assembly, steel_stud_eq_conductivity: float | None
) -> float:
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

    Args:
        assembly: The Assembly with layers to calculate
        steel_stud_eq_conductivity: Pre-calculated equivalent conductivity for
            steel stud layers (None if assembly has no steel studs)
    """
    layers = assembly.layers

    # If all layers are single-segment (homogeneous), reduces to simple series sum
    if all(len(layer.segments) == 1 for layer in layers):
        return _sum_layer_r_values_simple(assembly, steel_stud_eq_conductivity)

    # Generate all possible paths through the assembly
    # Each path is a tuple of segment indices for each layer
    segment_indices_per_layer = [range(len(layer.segments)) for layer in layers]
    all_paths = list(product(*segment_indices_per_layer))

    total_u = 0.0
    for path in all_paths:
        path_r = _calculate_path_r_value(assembly, path, steel_stud_eq_conductivity)
        area_fraction = _calculate_path_area_fraction(layers, path)

        if path_r > 0:
            total_u += area_fraction / path_r

    return 1.0 / total_u if total_u > 0 else 0.0


def _calculate_isothermal_planes_r_value(
    assembly: Assembly, steel_stud_eq_conductivity: float | None
) -> float:
    """
    ISOTHERMAL-PLANES (SERIES) METHOD (ASHRAE Chapter 27, Section 1.2)

    Assumes temperature is uniform across each plane perpendicular to heat flow.
    For heterogeneous layers, calculates an area-weighted average R-value.

    Formula:
        For homogeneous layer: R_layer = thickness / conductivity
        For heterogeneous layer: R_layer = 1 / SUM(area_fraction_i / R_i)
        Total R = SUM(R_layer) for all layers in series

    Args:
        assembly: The Assembly with layers to calculate
        steel_stud_eq_conductivity: Pre-calculated equivalent conductivity for
            steel stud layers (None if assembly has no steel studs)
    """
    total_r = 0.0

    for layer in assembly.layers:
        thickness_m = layer.thickness_mm / 1000.0

        if len(layer.segments) == 1:
            # Homogeneous layer: R = d/k
            segment = layer.segments[0]
            conductivity = _get_effective_conductivity(
                segment, assembly, steel_stud_eq_conductivity
            )

            if conductivity and conductivity > 0:
                total_r += thickness_m / conductivity
        else:
            # Heterogeneous layer: area-weighted parallel combination
            total_width = sum(s.width_mm for s in layer.segments)
            sum_u_fraction = 0.0

            for segment in layer.segments:
                conductivity = _get_effective_conductivity(
                    segment, assembly, steel_stud_eq_conductivity
                )

                if conductivity and conductivity > 0 and total_width > 0:
                    area_fraction = segment.width_mm / total_width
                    segment_r = thickness_m / conductivity
                    sum_u_fraction += area_fraction / segment_r

            if sum_u_fraction > 0:
                total_r += 1.0 / sum_u_fraction

    return total_r


def _sum_layer_r_values_simple(
    assembly: Assembly, steel_stud_eq_conductivity: float | None
) -> float:
    """Calculate total R-value for assembly with all single-segment layers (series only).

    Args:
        assembly: The Assembly with layers to calculate
        steel_stud_eq_conductivity: Pre-calculated equivalent conductivity for
            steel stud layers (None if assembly has no steel studs)
    """
    total_r = 0.0

    for layer in assembly.layers:
        thickness_m = layer.thickness_mm / 1000.0
        segment = layer.segments[0]
        conductivity = _get_effective_conductivity(
            segment, assembly, steel_stud_eq_conductivity
        )

        if conductivity and conductivity > 0:
            total_r += thickness_m / conductivity

    return total_r


def _calculate_path_r_value(
    assembly: Assembly, path: tuple[int, ...], steel_stud_eq_conductivity: float | None
) -> float:
    """
    Calculate the total R-value along a specific path through the assembly.

    A path specifies which segment to use from each layer. The R-values
    are added in series along the path.

    Args:
        assembly: The Assembly with layers to calculate
        path: Tuple of segment indices for each layer
        steel_stud_eq_conductivity: Pre-calculated equivalent conductivity for
            steel stud layers (None if assembly has no steel studs)
    """
    total_r = 0.0

    for layer, segment_idx in zip(assembly.layers, path):
        thickness_m = layer.thickness_mm / 1000.0
        segment = layer.segments[segment_idx]
        conductivity = _get_effective_conductivity(
            segment, assembly, steel_stud_eq_conductivity
        )

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
            conductivity = (
                segment.material.conductivity_w_mk if segment.material else None
            )

            if not conductivity or conductivity <= 0:
                warnings.append(
                    f"Layer {layer_num}, Segment {segment_num} has invalid conductivity"
                )

            if segment.width_mm <= 0:
                warnings.append(
                    f"Layer {layer_num}, Segment {segment_num} has zero or negative width"
                )

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
