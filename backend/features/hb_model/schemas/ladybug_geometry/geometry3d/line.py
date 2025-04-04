# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: ladybug_geometry.geometry3d.line"""

from pydantic.main import BaseModel


class LineSegment3DSchema(BaseModel):
    p: tuple[float, float, float]
    v: tuple[float, float, float]
