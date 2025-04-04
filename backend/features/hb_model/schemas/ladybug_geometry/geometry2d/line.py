# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: ladybug_geometry.geometry2d.line.LineSegment2D"""

from pydantic.main import BaseModel


class LineSegment2D(BaseModel):
    p: tuple[float, float]
    v: tuple[float, float]
