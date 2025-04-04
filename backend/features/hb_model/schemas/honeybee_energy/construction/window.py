# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: honeybee_energy.construction.window.WindowConstruction"""


from pydantic.main import BaseModel


class WindowConstructionSchema(BaseModel):
    identifier: str
    type: str
    r_factor: float = 0.0
    u_factor: float = 0.0
