# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: honeybee_energy.properties.window.WindowConstruction"""

from pydantic.main import BaseModel

from ..construction.window import WindowConstructionSchema


class ApertureEnergyPropertiesSchema(BaseModel):
    construction: WindowConstructionSchema | None = None
