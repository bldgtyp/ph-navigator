"""Canonical SI/IP conversions for aperture U-value reports and exports."""

from __future__ import annotations

from features.shared.units import UnitSystem

ExportUnitSystem = UnitSystem

M_TO_FT = 3.280839895013123
MM_TO_IN = 0.03937007874015748
M2_TO_FT2 = M_TO_FT**2
W_M2K_TO_BTU_HRFT2F = 0.1761101838

# 1 W = 3.412141633 Btu/h; 1 m = 3.280839895 ft; 1 K = 1.8 °F.
W_MK_TO_BTU_HRFTF = 3.412141633 / M_TO_FT / 1.8
W_K_TO_BTU_HRF = 3.412141633 / 1.8


def length_from_m(value: float | None, units: ExportUnitSystem) -> float | None:
    if value is None:
        return None
    return value if units == "SI" else value * M_TO_FT


def frame_width_from_m(value: float | None, units: ExportUnitSystem) -> float | None:
    if value is None:
        return None
    return value * 1000.0 if units == "SI" else value * 1000.0 * MM_TO_IN


def area_from_m2(value: float | None, units: ExportUnitSystem) -> float | None:
    if value is None:
        return None
    return value if units == "SI" else value * M2_TO_FT2


def u_value_from_w_m2k(value: float | None, units: ExportUnitSystem) -> float | None:
    if value is None:
        return None
    return value if units == "SI" else value * W_M2K_TO_BTU_HRFT2F


def psi_from_w_mk(value: float | None, units: ExportUnitSystem) -> float | None:
    if value is None:
        return None
    return value if units == "SI" else value * W_MK_TO_BTU_HRFTF


def heat_flow_from_w_k(value: float | None, units: ExportUnitSystem) -> float | None:
    if value is None:
        return None
    return value if units == "SI" else value * W_K_TO_BTU_HRF


def length_label(units: ExportUnitSystem) -> str:
    return "m" if units == "SI" else "ft"


def frame_width_label(units: ExportUnitSystem) -> str:
    return "mm" if units == "SI" else "in"


def area_label(units: ExportUnitSystem) -> str:
    return "m²" if units == "SI" else "ft²"


def u_value_label(units: ExportUnitSystem) -> str:
    return "W/(m²·K)" if units == "SI" else "Btu/(h·ft²·°F)"


def psi_label(units: ExportUnitSystem) -> str:
    return "W/(m·K)" if units == "SI" else "Btu/(h·ft·°F)"


def heat_flow_label(units: ExportUnitSystem) -> str:
    return "W/K" if units == "SI" else "Btu/(h·°F)"
