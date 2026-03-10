# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: ladybug_geometry.geometry3d.mesh.Mesh3D"""

from pydantic import BaseModel


class Mesh3DSchema(BaseModel):
    vertices: list[list[float]]
    faces: list[list[int]]
