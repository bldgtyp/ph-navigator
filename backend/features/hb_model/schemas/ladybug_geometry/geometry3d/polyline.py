# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: ladybug_geometry.geometry3d.polyline.PolyLine3D"""

from pydantic import BaseModel


class Polyline3D(BaseModel):
    vertices: list[tuple[float, float, float]]
