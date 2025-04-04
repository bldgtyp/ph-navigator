# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: ladybug_geometry.geometry3d.arc.Arc3D"""

from pydantic.main import BaseModel

from .plane import PlaneSchema


class Arc3D(BaseModel):
    plane: PlaneSchema
    radius: float
    a1: float
    a2: float
