# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: honeybee_phhvac.hot_water_system.PhHotWaterSystemSchema"""

from pydantic.main import BaseModel

from .hot_water_piping import PhHvacPipeElementSchema, PhHvacPipeTrunkSchema


class PhHotWaterSystemSchema(BaseModel):
    distribution_piping: dict[str, PhHvacPipeTrunkSchema]
    recirc_piping: dict[str, PhHvacPipeElementSchema]
