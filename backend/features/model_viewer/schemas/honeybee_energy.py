"""Pydantic mirrors of honeybee_energy constructions and materials.

D-12: constructions serialize all four thermal fields, for opaque AND
window constructions, LBT-verbatim — `*_factor` includes standard air-film
resistances (EN673/ISO10292), `*_value` is material layers only. No
relabeling on the wire; the frontend inspector shows both rows.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class EnergyMaterialSchema(BaseModel):
    """honeybee_energy.material.opaque.EnergyMaterial."""

    type: str
    thickness: float
    conductivity: float
    specific_heat: float
    roughness: str
    visible_absorptance: float
    thermal_absorptance: float
    solar_absorptance: float
    density: float


class OpaqueConstructionSchema(BaseModel):
    """honeybee_energy.construction.opaque.OpaqueConstruction.

    Used as the AirBoundary tripwire: an AirBoundary construction fails
    this schema's validation (no opaque materials), which is what makes
    the extraction service skip + count the face (Q-VIEW-1).
    """

    identifier: str
    type: str
    u_factor: float = Field(default=0.0, description="W/m²K, air films included")
    u_value: float = Field(default=0.0, description="W/m²K, air films excluded")
    r_factor: float = Field(default=0.0, description="m²K/W, air films included")
    r_value: float = Field(default=0.0, description="m²K/W, air films excluded")
    materials: list[EnergyMaterialSchema]


class WindowConstructionSchema(BaseModel):
    """honeybee_energy.construction.window.WindowConstruction."""

    identifier: str
    type: str
    u_factor: float = Field(default=0.0, description="W/m²K, air films included")
    u_value: float = Field(default=0.0, description="W/m²K, air films excluded")
    r_factor: float = Field(default=0.0, description="m²K/W, air films included")
    r_value: float = Field(default=0.0, description="m²K/W, air films excluded")


class FaceEnergyPropertiesSchema(BaseModel):
    """honeybee_energy.properties.face.FaceEnergyProperties."""

    construction: OpaqueConstructionSchema | None = None


class ApertureEnergyPropertiesSchema(BaseModel):
    """honeybee_energy.properties.aperture.ApertureEnergyProperties."""

    construction: WindowConstructionSchema | None = None
