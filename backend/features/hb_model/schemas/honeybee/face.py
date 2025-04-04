# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: honeybee.face.Face"""


from pydantic.main import BaseModel

from ..ladybug_geometry.geometry3d.face3d import Face3DSchema
from .aperture import ApertureSchema
from .boundarycondition import BoundaryConditionSchema
from .properties import FacePropertiesSchema


class FaceSchema(BaseModel):
    type: str
    identifier: str
    face_type: str
    display_name: str
    geometry: Face3DSchema
    boundary_condition: BoundaryConditionSchema
    apertures: list[ApertureSchema] = []
    properties: FacePropertiesSchema
