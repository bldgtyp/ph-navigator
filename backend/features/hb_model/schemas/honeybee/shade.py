# -*- coding: utf-8 -*-
# -*- Python Version: 3.11 -*-

"""Pydantic Schema: honeybee.shade.Shade"""

from typing import Any

from pydantic.main import BaseModel

from ..ladybug_geometry.geometry3d.face3d import Face3DSchema


class ShadeSchema(BaseModel):
    type: str
    identifier: str
    user_data: dict[Any, Any] | None = None
    display_name: str
    is_detached: bool
    geometry: Face3DSchema


class ShadeGroupSchema(BaseModel):
    shades: list[ShadeSchema] = []
