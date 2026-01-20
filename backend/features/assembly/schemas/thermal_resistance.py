# -*- Python Version: 3.11 -*-

"""
Pydantic schemas for thermal resistance API responses.

These schemas define the structure of thermal resistance calculation results
returned by the API endpoints.
"""

from pydantic import BaseModel, Field


class ThermalResistanceSchema(BaseModel):
    """
    Schema for thermal resistance calculation result.

    All R-values are in SI units: m2-K/W (square meter Kelvin per Watt)
    U-value is in SI units: W/m2-K (Watts per square meter Kelvin)

    The Passive House method averages two ASHRAE calculation methods:
        R_effective = (R_parallel_path + R_isothermal_planes) / 2

    Reference: ASHRAE Handbook - Fundamentals, Chapter 27
    """

    r_parallel_path_si: float = Field(
        ...,
        description="R-value calculated using the Parallel-Path method (m2-K/W)",
        ge=0,
    )
    r_isothermal_planes_si: float = Field(
        ...,
        description="R-value calculated using the Isothermal-Planes method (m2-K/W)",
        ge=0,
    )
    r_effective_si: float = Field(
        ...,
        description="Effective R-value using Passive House method (average of both methods) (m2-K/W)",
        ge=0,
    )
    u_effective_si: float = Field(
        ...,
        description="Effective U-value (1/R_effective) (W/m2-K)",
        ge=0,
    )
    is_valid: bool = Field(
        ...,
        description="Whether the calculation succeeded (True) or failed due to invalid data (False)",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="List of warning/error messages if calculation failed or had issues",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "r_parallel_path_si": 3.42,
                "r_isothermal_planes_si": 3.58,
                "r_effective_si": 3.50,
                "u_effective_si": 0.286,
                "is_valid": True,
                "warnings": [],
            }
        }
