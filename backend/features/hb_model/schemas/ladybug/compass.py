# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: ladybug.compass.Compass"""

from pydantic.main import BaseModel

from ..ladybug_geometry.geometry2d.arc import Arc2D
from ..ladybug_geometry.geometry2d.line import LineSegment2D


class CompassSchema(BaseModel):
    all_boundary_circles: list[Arc2D] = []
    major_azimuth_ticks: list[LineSegment2D] = []
    minor_azimuth_ticks: list[LineSegment2D] = []
