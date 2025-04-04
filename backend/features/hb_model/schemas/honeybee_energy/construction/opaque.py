# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: honeybee_energy.construction.opaque.OpaqueConstruction"""


from pydantic.main import BaseModel

from ..material.opaque import EnergyMaterialSchema


class OpaqueConstructionSchema(BaseModel):
    identifier: str
    type: str
    r_factor: float = 0.0
    u_factor: float = 0.0
    materials: list[EnergyMaterialSchema]
