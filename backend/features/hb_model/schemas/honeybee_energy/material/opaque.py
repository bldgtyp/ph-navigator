# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: honeybee_energy.material.opaque.EnergyMaterial"""

from pydantic.main import BaseModel


class EnergyMaterialSchema(BaseModel):
    type: str
    thickness: float
    conductivity: float
    specific_heat: float
    roughness: str
    visible_absorptance: float
    thermal_absorptance: float
    solar_absorptance: float
    density: float
