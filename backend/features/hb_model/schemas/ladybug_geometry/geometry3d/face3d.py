# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: ladybug_geometry.geometry3d.face.Face3D"""

from pydantic.main import BaseModel

from .mesh3d import Mesh3DSchema
from .plane import PlaneSchema


class Face3DSchema(BaseModel):
    boundary: list[list[float]]
    plane: PlaneSchema
    mesh: Mesh3DSchema | None = None
    area: float | None = None
