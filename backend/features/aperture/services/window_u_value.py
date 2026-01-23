# -*- Python Version: 3.11 -*-

"""
Window U-value (U-w) calculation per ISO 10077-1:2006.

Calculates the thermal transmittance of windows including contributions from:
- Frame heat loss (area × U-value per side)
- Glazing heat loss (area × U-value)
- Spacer heat loss (perimeter × psi-glazing)

Note: This calculates UNINSTALLED U-w. Psi-install is excluded per the
Passive House method for window-only transmittance.

Reference: ISO 10077-1:2006, Equation 1
    U_w = (Σ A_g·U_g + Σ A_f·U_f + Σ l_g·Ψ_g) / (Σ A_g + Σ A_f)

Corner Handling:
    Frame areas at corners are split at a 45° angle, with each side
    receiving half of its adjacent corner areas.
"""

import hashlib
import logging
from dataclasses import dataclass

from db_entities.aperture.aperture import Aperture
from db_entities.aperture.aperture_element import ApertureElement
from db_entities.aperture.aperture_frame import ApertureElementFrame
from db_entities.aperture.frame_type import ApertureFrameType
from features.hb_model.cache import LimitedCache

logger = logging.getLogger(__name__)

# Content-addressable cache for U-value results
# Key is a hash of all calculation inputs; no explicit invalidation needed
_U_VALUE_CACHE: LimitedCache["WindowUValueResult"] = LimitedCache(max_size=50)


def _generate_u_value_cache_key(aperture: Aperture) -> str:
    """Generate a content-addressable cache key from all U-value calculation inputs.

    The key is a hash of all values that affect the calculation result:
    - Aperture dimensions (row_heights_mm, column_widths_mm)
    - Element positions and spans
    - Frame properties (width, U-value, psi-g) for each side
    - Glazing U-value

    When any input changes, the hash changes automatically - no explicit invalidation needed.
    """
    hasher = hashlib.sha256()

    # Aperture dimensions
    hasher.update(f"rows:{aperture.row_heights_mm}".encode())
    hasher.update(f"cols:{aperture.column_widths_mm}".encode())

    # Sort elements by position for consistent ordering
    sorted_elements = sorted(
        aperture.elements, key=lambda e: (e.row_number, e.column_number)
    )

    for element in sorted_elements:
        hasher.update(f"elem_id:{element.id}".encode())
        hasher.update(f"elem:{element.row_number},{element.column_number}".encode())
        hasher.update(f"span:{element.row_span},{element.col_span}".encode())

        # Frame properties for each side
        for side in ["top", "right", "bottom", "left"]:
            frame = getattr(element, f"frame_{side}")
            if frame and frame.frame_type:
                ft = frame.frame_type
                hasher.update(
                    f"f_{side}:{ft.width_mm},{ft.u_value_w_m2k},{ft.psi_g_w_mk}".encode()
                )
            else:
                hasher.update(f"f_{side}:None".encode())

        # Glazing properties
        if element.glazing and element.glazing.glazing_type:
            hasher.update(f"glz:{element.glazing.glazing_type.u_value_w_m2k}".encode())
        else:
            hasher.update(b"glz:None")

    return hasher.hexdigest()[:16]  # Use first 16 chars of hash


@dataclass
class FrameData:
    """Frame data for one side of an element (converted to SI units)."""

    width_m: float
    u_value_w_m2k: float
    psi_glazing_w_mk: float


@dataclass
class ElementCalculation:
    """Calculation results for a single aperture element."""

    element_id: int
    width_m: float
    height_m: float
    total_area_m2: float
    glazing_area_m2: float
    frame_area_m2: float
    glazing_perimeter_m: float
    heat_loss_glazing_w_k: float
    heat_loss_frame_w_k: float
    heat_loss_spacer_w_k: float
    u_value_w_m2k: float  # Element-specific U-value


@dataclass
class WindowUValueResult:
    """Result of U-value calculation for an aperture.

    All values in SI units.
    """

    u_value_w_m2k: float
    total_area_m2: float
    glazing_area_m2: float
    frame_area_m2: float
    heat_loss_glazing_w_k: float
    heat_loss_frame_w_k: float
    heat_loss_spacer_w_k: float
    is_valid: bool
    warnings: list[str]
    element_calculations: list[ElementCalculation]
    calculation_method: str = "ISO 10077-1:2006"
    includes_psi_install: bool = False


def calculate_aperture_u_value(aperture: Aperture) -> WindowUValueResult:
    """
    Calculate the effective U-value for an entire aperture (window/door).

    Uses content-addressable caching: the cache key is derived from all calculation
    inputs, so when any input changes, the key changes automatically.

    Args:
        aperture: The Aperture entity with elements, frames, and glazing loaded

    Returns:
        WindowUValueResult with U-value in W/m²K

    Reference:
        ISO 10077-1:2006, Equation 1
    """
    logger.info(
        f"calculate_aperture_u_value(aperture_id={aperture.id}, name={aperture.name})"
    )

    # Check cache first
    cache_key = _generate_u_value_cache_key(aperture)
    cached_result = _U_VALUE_CACHE[cache_key]
    if cached_result is not None:
        logger.info(f"Cache hit for aperture {aperture.id} (key={cache_key[:8]}...)")
        return cached_result

    # Validate inputs
    warnings = _validate_aperture(aperture)
    if warnings:
        return _invalid_result(warnings)

    # Calculate for each element
    element_results: list[ElementCalculation] = []
    for element in aperture.elements:
        element_width_m = _get_element_width_m(aperture, element)
        element_height_m = _get_element_height_m(aperture, element)

        result = _calculate_element(element, element_width_m, element_height_m)
        if result:
            element_results.append(result)

    if not element_results:
        return _invalid_result(["No valid elements to calculate"])

    # Aggregate results
    total_area = sum(e.total_area_m2 for e in element_results)
    glazing_area = sum(e.glazing_area_m2 for e in element_results)
    frame_area = sum(e.frame_area_m2 for e in element_results)
    heat_loss_glazing = sum(e.heat_loss_glazing_w_k for e in element_results)
    heat_loss_frame = sum(e.heat_loss_frame_w_k for e in element_results)
    heat_loss_spacer = sum(e.heat_loss_spacer_w_k for e in element_results)

    # Calculate U-value: (Q_glazing + Q_frame + Q_spacer) / A_total
    total_heat_loss = heat_loss_glazing + heat_loss_frame + heat_loss_spacer
    u_value = total_heat_loss / total_area if total_area > 0 else 0.0

    logger.info(
        f"Window U-value calculated: U_w={u_value:.4f} W/m²K, "
        f"A_total={total_area:.4f} m², A_glazing={glazing_area:.4f} m², "
        f"A_frame={frame_area:.4f} m²"
    )

    result = WindowUValueResult(
        u_value_w_m2k=round(u_value, 4),
        total_area_m2=round(total_area, 6),
        glazing_area_m2=round(glazing_area, 6),
        frame_area_m2=round(frame_area, 6),
        heat_loss_glazing_w_k=round(heat_loss_glazing, 6),
        heat_loss_frame_w_k=round(heat_loss_frame, 6),
        heat_loss_spacer_w_k=round(heat_loss_spacer, 6),
        is_valid=True,
        warnings=[],
        element_calculations=element_results,
    )

    # Store in cache
    _U_VALUE_CACHE[cache_key] = result
    logger.info(f"Cached U-value for aperture {aperture.id} (key={cache_key[:8]}...)")

    return result


def _get_element_width_m(aperture: Aperture, element: ApertureElement) -> float:
    """Get the total width of an element in meters, accounting for column span.

    Args:
        aperture: The aperture containing column_widths_mm (in millimeters)
        element: The element with column_number (0-indexed) and col_span

    Returns:
        Width in meters (converted from mm)
    """
    col_start = element.column_number  # 0-indexed
    col_end = col_start + element.col_span
    width_mm = sum(aperture.column_widths_mm[col_start:col_end])
    return width_mm / 1000.0  # mm → m


def _get_element_height_m(aperture: Aperture, element: ApertureElement) -> float:
    """Get the total height of an element in meters, accounting for row span.

    Args:
        aperture: The aperture containing row_heights_mm (in millimeters)
        element: The element with row_number (0-indexed) and row_span

    Returns:
        Height in meters (converted from mm)
    """
    row_start = element.row_number  # 0-indexed
    row_end = row_start + element.row_span
    height_mm = sum(aperture.row_heights_mm[row_start:row_end])
    return height_mm / 1000.0  # mm → m


def _calculate_element(
    element: ApertureElement,
    width_m: float,
    height_m: float,
) -> ElementCalculation | None:
    """Calculate U-value components for a single aperture element.

    Args:
        element: The aperture element with frame and glazing data
        width_m: Element width in meters (already converted from mm)
        height_m: Element height in meters (already converted from mm)

    Returns:
        ElementCalculation with all values in SI units, or None if data is missing
    """
    # Get frame data for each side (converted to SI units internally)
    frame_top = _get_frame_data(element.frame_top)
    frame_right = _get_frame_data(element.frame_right)
    frame_bottom = _get_frame_data(element.frame_bottom)
    frame_left = _get_frame_data(element.frame_left)

    # Explicit None checks for type narrowing (Pylance doesn't narrow with `all()`)
    if (
        frame_top is None
        or frame_right is None
        or frame_bottom is None
        or frame_left is None
    ):
        logger.warning(f"Element {element.id} missing frame data, skipping")
        return None

    # Get glazing U-value
    glazing_u_value = _get_glazing_u_value(element)
    if glazing_u_value is None:
        logger.warning(f"Element {element.id} missing glazing data, skipping")
        return None

    # Calculate interior dimensions (inside the frames) - all in meters
    interior_width = width_m - frame_left.width_m - frame_right.width_m
    interior_height = height_m - frame_top.width_m - frame_bottom.width_m

    if interior_width <= 0 or interior_height <= 0:
        logger.warning(
            f"Element {element.id} has non-positive glazing dimensions, skipping"
        )
        return None

    # Areas in m²
    total_area = width_m * height_m
    glazing_area = interior_width * interior_height
    frame_area = total_area - glazing_area

    # Glazing perimeter in meters (inside frame edges)
    glazing_perimeter = 2 * (interior_width + interior_height)

    # Heat losses in W/K
    heat_loss_glazing = glazing_area * glazing_u_value

    # Frame heat loss per side (with corner handling)
    heat_loss_frame = (
        _side_frame_heat_loss(frame_top, frame_left, frame_right, interior_width)
        + _side_frame_heat_loss(frame_right, frame_top, frame_bottom, interior_height)
        + _side_frame_heat_loss(frame_bottom, frame_left, frame_right, interior_width)
        + _side_frame_heat_loss(frame_left, frame_top, frame_bottom, interior_height)
    )

    # Spacer heat loss per side
    heat_loss_spacer = (
        _side_spacer_heat_loss(frame_top, interior_width)
        + _side_spacer_heat_loss(frame_right, interior_height)
        + _side_spacer_heat_loss(frame_bottom, interior_width)
        + _side_spacer_heat_loss(frame_left, interior_height)
    )

    # Calculate element-specific U-value
    total_heat_loss = heat_loss_glazing + heat_loss_frame + heat_loss_spacer
    element_u_value = total_heat_loss / total_area if total_area > 0 else 0.0

    return ElementCalculation(
        element_id=element.id,
        width_m=width_m,
        height_m=height_m,
        total_area_m2=total_area,
        glazing_area_m2=glazing_area,
        frame_area_m2=frame_area,
        glazing_perimeter_m=glazing_perimeter,
        heat_loss_glazing_w_k=heat_loss_glazing,
        heat_loss_frame_w_k=heat_loss_frame,
        heat_loss_spacer_w_k=heat_loss_spacer,
        u_value_w_m2k=round(element_u_value, 4),
    )


def _get_frame_data(frame: ApertureElementFrame | None) -> FrameData | None:
    """Extract frame data from an ApertureElementFrame, converting to SI units.

    Args:
        frame: The frame element containing frame_type with width_mm

    Returns:
        FrameData with width in meters (converted from mm), or None if missing
    """
    if frame is None or frame.frame_type is None:
        return None

    ft: ApertureFrameType = frame.frame_type
    return FrameData(
        width_m=ft.width_mm / 1000.0,  # mm → m
        u_value_w_m2k=ft.u_value_w_m2k,  # Already in W/m²K
        psi_glazing_w_mk=ft.psi_g_w_mk,  # Already in W/mK
    )


def _get_glazing_u_value(element: ApertureElement) -> float | None:
    """Get the glazing U-value for an element."""
    if element.glazing is None or element.glazing.glazing_type is None:
        return None
    return element.glazing.glazing_type.u_value_w_m2k


def _side_frame_heat_loss(
    frame: FrameData,
    adj_frame_1: FrameData,
    adj_frame_2: FrameData,
    interior_length: float,
) -> float:
    """
    Calculate frame heat loss for one side, including corner contributions.

    Corner areas are split at 45° angles: each side gets half of its
    two corner areas.

    Args:
        frame: Frame data for this side (width_m in meters)
        adj_frame_1: First adjacent frame (left/right for top/bottom, top/bottom for left/right)
        adj_frame_2: Second adjacent frame
        interior_length: Interior length along this side in meters

    Returns:
        Heat loss in W/K
    """
    # Center area: frame width × interior length
    center_area = frame.width_m * interior_length

    # Corner areas (45° split - half of each corner)
    corner_area_1 = (frame.width_m * adj_frame_1.width_m) / 2.0
    corner_area_2 = (frame.width_m * adj_frame_2.width_m) / 2.0
    total_corner_area = corner_area_1 + corner_area_2

    # Total frame area for this side
    side_area = center_area + total_corner_area

    return side_area * frame.u_value_w_m2k


def _side_spacer_heat_loss(frame: FrameData, interior_length: float) -> float:
    """
    Calculate spacer heat loss for one side.

    The spacer runs along the interior edge (inside the frame).

    Args:
        frame: Frame data for this side (contains psi_glazing value)
        interior_length: Length of the glazing edge on this side

    Returns:
        Heat loss in W/K
    """
    return interior_length * frame.psi_glazing_w_mk


def _validate_aperture(aperture: Aperture) -> list[str]:
    """Validate aperture data for U-value calculation."""
    warnings: list[str] = []

    if not aperture.elements:
        warnings.append("Aperture has no elements")
        return warnings

    if not aperture.row_heights_mm:
        warnings.append("Aperture has no row heights defined")

    if not aperture.column_widths_mm:
        warnings.append("Aperture has no column widths defined")

    for element in aperture.elements:
        if element.glazing is None:
            warnings.append(f"Element {element.id} has no glazing assigned")
        elif element.glazing.glazing_type is None:
            warnings.append(f"Element {element.id} glazing has no type assigned")

        for side in ["top", "right", "bottom", "left"]:
            frame = getattr(element, f"frame_{side}")
            if frame is None:
                warnings.append(f"Element {element.id} has no {side} frame assigned")
            elif frame.frame_type is None:
                warnings.append(
                    f"Element {element.id} {side} frame has no type assigned"
                )

    return warnings


def _invalid_result(warnings: list[str]) -> WindowUValueResult:
    """Return an invalid result with the given warnings."""
    return WindowUValueResult(
        u_value_w_m2k=0.0,
        total_area_m2=0.0,
        glazing_area_m2=0.0,
        frame_area_m2=0.0,
        heat_loss_glazing_w_k=0.0,
        heat_loss_frame_w_k=0.0,
        heat_loss_spacer_w_k=0.0,
        is_valid=False,
        warnings=warnings,
        element_calculations=[],
    )
