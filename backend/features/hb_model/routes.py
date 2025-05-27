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


@router.get("/{bt_number}/faces", response_model=list[FaceSchema])
async def get_faces(bt_number: str, db: Session = Depends(get_db)) -> list[FaceSchema]:
    """Return a list of all the Faces from a Project's Honeybee-Model."""
    logger.info(f"get_faces({bt_number=})")

    hb_model = await load_hb_model(db, bt_number)
    hb_faces = await get_faces_from_model(hb_model)
    return hb_faces


@router.get("/{bt_number}/spaces", response_model=list[SpaceSchema])
async def get_spaces(
    bt_number: str, db: Session = Depends(get_db)
) -> list[SpaceSchema]:
    """Return a list of all the Spaces from a Project's Honeybee-Model."""
    logger.info(f"get_spaces({bt_number=})")

    hb_model = await load_hb_model(db, bt_number)
    hb_spaces = await get_spaces_from_model(hb_model)
    return hb_spaces


@router.get("/{bt_number}/sun_path", response_model=SunPathAndCompassDTOSchema)
async def get_sun_path(
    bt_number: str, db: Session = Depends(get_db)
) -> SunPathAndCompassDTOSchema:
    """Return a list of all the Sun Path from a Project's Honeybee-Model."""
    logger.info(f"get_sun_path({bt_number=})")

    epw = await load_epw_object(db, bt_number)
    sun_path = await get_sun_path_from_model(epw)
    return sun_path


@router.get(
    "/{bt_number}/hot_water_systems", response_model=list[PhHotWaterSystemSchema]
)
async def get_hot_water_systems(
    bt_number: str, db: Session = Depends(get_db)
) -> list[PhHotWaterSystemSchema]:
    """Return a list of all the Hot Water Systems from a Project's Honeybee-Model."""
    logger.info(f"get_hot_water_systems({bt_number=})")

    hb_model = await load_hb_model(db, bt_number)
    hw_systems = await get_hot_water_systems_from_model(hb_model)
    return hw_systems


@router.get(
    "/{bt_number}/ventilation_systems", response_model=list[PhVentilationSystemSchema]
)
async def get_ventilation_systems(
    bt_number: str, db: Session = Depends(get_db)
) -> list[PhVentilationSystemSchema]:
    """Return a list of all the Ventilation Systems from a Project's Honeybee-Model."""
    logger.info(f"get_ventilation_systems({bt_number=})")

    hb_model = await load_hb_model(db, bt_number)
    vent_systems = await get_ventilation_systems_from_model(hb_model)
    return vent_systems


@router.get("/{bt_number}/shading_elements", response_model=list[ShadeGroupSchema])
async def get_shading_elements(
    bt_number: str, db: Session = Depends(get_db)
) -> list[ShadeGroupSchema]:
    """Return a list of all the Shading Elements from a Project's Honeybee-Model."""
    logger.info(f"get_shading_elements({bt_number=})")

    hb_model = await load_hb_model(db, bt_number)
    shading = await get_shading_elements_from_model(hb_model)
    return shading
