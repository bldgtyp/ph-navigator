# -*- Python Version: 3.11 -*-

"""Routes for the THREE.js 3D Model Viewer."""

from logging import getLogger

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db

from .schemas.honeybee.face import FaceSchema
from .schemas.honeybee.shade import ShadeGroupSchema
from .schemas.honeybee_ph.space import SpaceSchema
from .schemas.honeybee_phhvac.hot_water_system import PhHotWaterSystemSchema
from .schemas.honeybee_phhvac.ventilation import PhVentilationSystemSchema
from .schemas.ladybug.sunpath import SunPathAndCompassDTOSchema
from .services.epw import load_epw_object
from .services.hb_model import load_hb_model
from .services.model_elements import (
    get_faces_from_model,
    get_hot_water_systems_from_model,
    get_shading_elements_from_model,
    get_spaces_from_model,
    get_sun_path_from_model,
    get_ventilation_systems_from_model,
)

# ----------------------------------------------------------------------------------------------------------------------


router = APIRouter(
    prefix="/hb_model",
    tags=["honeybee_model"],
)

logger = getLogger(__name__)


# ----------------------------------------------------------------------------------------------------------------------


@router.get("/{project_id}/faces", response_model=list[FaceSchema])
async def get_faces(project_id: int, db: Session = Depends(get_db)) -> list[FaceSchema]:
    """Return a list of all the Faces from a Project's Honeybee-Model."""
    logger.info(f"get_faces({project_id=})")

    hb_model = await load_hb_model(db, project_id)
    hb_faces = await get_faces_from_model(hb_model)
    return hb_faces


@router.get("/{project_id}/spaces", response_model=list[SpaceSchema])
async def get_spaces(
    project_id: int, db: Session = Depends(get_db)
) -> list[SpaceSchema]:
    """Return a list of all the Spaces from a Project's Honeybee-Model."""
    logger.info(f"get_spaces({project_id=})")

    hb_model = await load_hb_model(db, project_id)
    hb_spaces = await get_spaces_from_model(hb_model)
    return hb_spaces


@router.get("/{project_id}/sun_path", response_model=SunPathAndCompassDTOSchema)
async def get_sun_path(
    project_id: int, db: Session = Depends(get_db)
) -> SunPathAndCompassDTOSchema:
    """Return a list of all the Sun Path from a Project's Honeybee-Model."""
    logger.info(f"get_sun_path({project_id=})")

    epw = await load_epw_object(db, project_id)
    sun_path = await get_sun_path_from_model(epw)
    return sun_path


@router.get(
    "/{project_id}/hot_water_systems", response_model=list[PhHotWaterSystemSchema]
)
async def get_hot_water_systems(
    project_id: int, db: Session = Depends(get_db)
) -> list[PhHotWaterSystemSchema]:
    """Return a list of all the Hot Water Systems from a Project's Honeybee-Model."""
    logger.info(f"get_hot_water_systems({project_id=})")

    hb_model = await load_hb_model(db, project_id)
    hw_systems = await get_hot_water_systems_from_model(hb_model)
    return hw_systems


@router.get(
    "/{project_id}/ventilation_systems", response_model=list[PhVentilationSystemSchema]
)
async def get_ventilation_systems(
    project_id: int, db: Session = Depends(get_db)
) -> list[PhVentilationSystemSchema]:
    """Return a list of all the Ventilation Systems from a Project's Honeybee-Model."""
    logger.info(f"get_ventilation_systems({project_id=})")

    hb_model = await load_hb_model(db, project_id)
    vent_systems = await get_ventilation_systems_from_model(hb_model)
    return vent_systems


@router.get("/{project_id}/shading_elements", response_model=list[ShadeGroupSchema])
async def get_shading_elements(
    project_id: int, db: Session = Depends(get_db)
) -> list[ShadeGroupSchema]:
    """Return a list of all the Shading Elements from a Project's Honeybee-Model."""
    logger.info(f"get_shading_elements({project_id=})")

    hb_model = await load_hb_model(db, project_id)
    shading = await get_shading_elements_from_model(hb_model)
    return shading
