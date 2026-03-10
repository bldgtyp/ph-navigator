# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: honeybee_phhvac.ventilation.PhVentilationSystem"""

from pydantic import BaseModel


class VentilatorSchema(BaseModel):
    display_name: str
    identifier: str
    user_data: dict
    quantity: int
    sensible_heat_recovery: float
    latent_heat_recovery: float
    electric_efficiency: float
    frost_protection_reqd: bool
    temperature_below_defrost_used: float
    in_conditioned_space: bool


class PhVentilationSystemSchema(BaseModel):
    display_name: str
    sys_type: int
    supply_ducting: list = []
    exhaust_ducting: list = []
    ventilation_unit: VentilatorSchema | None = None
    id_num: int
