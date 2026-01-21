# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: honeybee_ph.space.properties"""


from typing import Any

from pydantic import Field
from pydantic.main import BaseModel


class SpacePhPropertiesSchema(BaseModel):
    """Schema for honeybee_ph space properties with airflow volumes in m³/h."""

    id_num: int | None = None
    type: str | None = None
    # Airflow volumes in m³/h (conversion from m³/s is done in service layer)
    v_eta: float | None = Field(None, alias="_v_eta")  # Extract air
    v_sup: float | None = Field(None, alias="_v_sup")  # Supply air
    v_tran: float | None = Field(None, alias="_v_tran")  # Transfer air

    class Config:
        # Allow population by field name or alias
        allow_population_by_field_name = True


class SpacePropertiesSchema(BaseModel):
    energy: Any  # TODO: Define actual schema
    ph: SpacePhPropertiesSchema | None = None
