"""Pydantic mirrors of honeybee_phhvac ventilation + hot-water systems.

Duct elements/segments are typed in V2 (V1 shipped them as raw untyped
dicts) so `duct_type` is a guaranteed wire field — the Ventilation lens
color-splits supply vs. exhaust on it (US-VIEW-7 crit. 7 / Q-VIEW-2).
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from features.model_viewer.schemas.ladybug_geometry import LineSegment3DSchema


class PhHvacDuctSegmentSchema(BaseModel):
    """honeybee_phhvac.ducting.PhDuctSegment (centerline + sizing)."""

    identifier: str
    display_name: str
    geometry: LineSegment3DSchema
    diameter: float
    height: float | None = None
    width: float | None = None
    insulation_thickness: float
    insulation_conductivity: float
    insulation_reflective: bool


class PhHvacDuctElementSchema(BaseModel):
    """honeybee_phhvac.ducting.PhDuctElement.

    `duct_type`: 1 = Supply, 2 = Exhaust (honeybee_phhvac convention).
    """

    identifier: str
    display_name: str
    duct_type: int
    segments: dict[str, PhHvacDuctSegmentSchema]


class VentilatorSchema(BaseModel):
    """honeybee_phhvac.ventilation.Ventilator (the ERV/HRV unit)."""

    display_name: str
    identifier: str
    user_data: dict[Any, Any]
    quantity: int
    sensible_heat_recovery: float
    latent_heat_recovery: float
    electric_efficiency: float
    frost_protection_reqd: bool
    temperature_below_defrost_used: float
    in_conditioned_space: bool


class PhVentilationSystemSchema(BaseModel):
    """honeybee_phhvac.ventilation.PhVentilationSystem."""

    identifier: str
    display_name: str
    sys_type: int
    supply_ducting: list[PhHvacDuctElementSchema] = []
    exhaust_ducting: list[PhHvacDuctElementSchema] = []
    ventilation_unit: VentilatorSchema | None = None
    id_num: int


class PhHvacPipeSegmentSchema(BaseModel):
    """honeybee_phhvac.hot_water_piping.PhPipeSegment (SI: mm / °C / m)."""

    geometry: LineSegment3DSchema
    diameter_mm: float
    insulation_thickness_mm: float
    insulation_conductivity: float
    insulation_reflective: bool
    insulation_quality: Any = None
    daily_period: float
    water_temp_c: float
    material_value: str
    length: float


class PhHvacPipeElementSchema(BaseModel):
    """A run of pipe segments; also the Fixture level of the tree."""

    identifier: str
    display_name: str
    user_data: dict[Any, Any]
    segments: dict[str, PhHvacPipeSegmentSchema]


class PhHvacPipeBranchSchema(BaseModel):
    identifier: str
    display_name: str
    user_data: dict[Any, Any]
    pipe_element: PhHvacPipeElementSchema
    fixtures: dict[str, PhHvacPipeElementSchema]


class PhHvacPipeTrunkSchema(BaseModel):
    identifier: str
    display_name: str
    user_data: dict[Any, Any]
    pipe_element: PhHvacPipeElementSchema
    branches: dict[str, PhHvacPipeBranchSchema]
    multiplier: float


class PhHotWaterSystemSchema(BaseModel):
    """honeybee_phhvac.hot_water_system.PhHotWaterSystem.

    Distribution is the 4-level tree (System → Trunk → Branch → Fixture →
    Segment); recirculation is a parallel flat dict of pipe elements.
    """

    identifier: str
    display_name: str
    distribution_piping: dict[str, PhHvacPipeTrunkSchema]
    recirc_piping: dict[str, PhHvacPipeElementSchema]
