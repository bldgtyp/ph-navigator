# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: honeybee.aperture.Aperture"""

from pydantic.main import BaseModel

from ..ladybug_geometry.geometry3d.face3d import Face3DSchema
from .boundarycondition import BoundaryConditionSchema
from .properties import AperturePropertiesSchema


class ApertureSchema(BaseModel):
    identifier: str
    display_name: str
    geometry: Face3DSchema
    face_type: str = "Aperture"
    boundary_condition: BoundaryConditionSchema
    properties: AperturePropertiesSchema

    class Config:
        """Pydantic Config."""
        orm_mode = True
