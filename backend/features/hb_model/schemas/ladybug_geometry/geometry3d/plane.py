# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: ladybug_geometry.geometry3d.plane.Plane"""

from pydantic import BaseModel


class PlaneSchema(BaseModel):
    n: list[float]
    o: list[float]
    x: list[float]
