# -*- Python Version: 3.11 -*-

"""Combined schema for all 3D model viewer data."""

from pydantic import BaseModel

from .honeybee.face import FaceSchema
from .honeybee.shade import ShadeGroupSchema
from .honeybee_ph.space import SpaceSchema
from .honeybee_phhvac.hot_water_system import PhHotWaterSystemSchema
from .honeybee_phhvac.ventilation import PhVentilationSystemSchema
from .ladybug.sunpath import SunPathAndCompassDTOSchema


class CombinedModelDataSchema(BaseModel):
    """Combined response containing all data needed for the 3D model viewer."""

    faces: list[FaceSchema]
    spaces: list[SpaceSchema]
    sun_path: SunPathAndCompassDTOSchema | None
    hot_water_systems: list[PhHotWaterSystemSchema]
    ventilation_systems: list[PhVentilationSystemSchema]
    shading_elements: list[ShadeGroupSchema]

    class Config:
        from_attributes = True
