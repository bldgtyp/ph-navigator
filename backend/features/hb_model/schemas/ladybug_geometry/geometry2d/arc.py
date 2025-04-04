# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: ladybug_geometry.geometry2d.arc.Arc2D"""

from pydantic.main import BaseModel


class Arc2D(BaseModel):
    c: tuple[float, float]
    r: float
    a1: float
    a2: float
