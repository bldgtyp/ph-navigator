# -*- Python Version: 3.11 -*-

"""Routes for the THREE.js 3D Model Viewer."""

from logging import getLogger

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from config import limiter
from database import get_db

from .schemas.combined_model_data import CombinedModelDataSchema
from .schemas.honeybee.face import FaceSchema
from .schemas.honeybee.shade import ShadeGroupSchema
from .schemas.honeybee_ph.space import SpaceSchema
from .schemas.honeybee_phhvac.hot_water_system import PhHotWaterSystemSchema
from .schemas.honeybee_phhvac.ventilation import PhVentilationSystemSchema
from .schemas.ladybug.sunpath import SunPathAndCompassDTOSchema
from .schemas.model_metadata import HBModelMetadataSchema
from .services.epw import load_epw_object
from .services.hb_model import list_available_models, load_hb_model
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


@router.get("/{bt_number}/models", response_model=list[HBModelMetadataSchema])
@limiter.limit("10/minute")
def get_available_models(
    request: Request, bt_number: str, db: Session = Depends(get_db)
) -> list[HBModelMetadataSchema]:
    """Return a list of all available HBJSON models for this project, sorted by date (newest first)."""
    logger.info(f"get_available_models({bt_number=})")
    return list_available_models(db, bt_number)


@router.get("/{bt_number}/faces", response_model=list[FaceSchema])
@limiter.limit("5/minute")
def get_faces(
    request: Request,
    bt_number: str,
    record_id: str | None = None,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
) -> list[FaceSchema]:
    """Return a list of all the Faces from a Project's Honeybee-Model."""
    logger.info(f"get_faces({bt_number=}, {record_id=}, {force_refresh=})")

    hb_model = load_hb_model(db, bt_number, record_id, force_refresh)
    hb_faces = get_faces_from_model(hb_model)
    return hb_faces


@router.get("/{bt_number}/spaces", response_model=list[SpaceSchema])
@limiter.limit("5/minute")
def get_spaces(
    request: Request,
    bt_number: str,
    record_id: str | None = None,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
) -> list[SpaceSchema]:
    """Return a list of all the Spaces from a Project's Honeybee-Model."""
    logger.info(f"get_spaces({bt_number=}, {record_id=}, {force_refresh=})")

    hb_model = load_hb_model(db, bt_number, record_id, force_refresh)
    hb_spaces = get_spaces_from_model(hb_model)
    return hb_spaces


@router.get("/{bt_number}/sun_path", response_model=SunPathAndCompassDTOSchema)
def get_sun_path(request: Request, bt_number: str, db: Session = Depends(get_db)) -> SunPathAndCompassDTOSchema:
    """Return a list of all the Sun Path from a Project's Honeybee-Model."""
    logger.info(f"get_sun_path({bt_number=})")

    epw = load_epw_object(db, bt_number)
    sun_path = get_sun_path_from_model(epw)
    return sun_path


@router.get("/{bt_number}/hot_water_systems", response_model=list[PhHotWaterSystemSchema])
@limiter.limit("5/minute")
def get_hot_water_systems(
    request: Request,
    bt_number: str,
    record_id: str | None = None,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
) -> list[PhHotWaterSystemSchema]:
    """Return a list of all the Hot Water Systems from a Project's Honeybee-Model."""
    logger.info(f"get_hot_water_systems({bt_number=}, {record_id=}, {force_refresh=})")

    hb_model = load_hb_model(db, bt_number, record_id, force_refresh)
    hw_systems = get_hot_water_systems_from_model(hb_model)
    return hw_systems


@router.get("/{bt_number}/ventilation_systems", response_model=list[PhVentilationSystemSchema])
@limiter.limit("5/minute")
def get_ventilation_systems(
    request: Request,
    bt_number: str,
    record_id: str | None = None,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
) -> list[PhVentilationSystemSchema]:
    """Return a list of all the Ventilation Systems from a Project's Honeybee-Model."""
    logger.info(f"get_ventilation_systems({bt_number=}, {record_id=}, {force_refresh=})")

    hb_model = load_hb_model(db, bt_number, record_id, force_refresh)
    vent_systems = get_ventilation_systems_from_model(hb_model)
    return vent_systems


@router.get("/{bt_number}/shading_elements", response_model=list[ShadeGroupSchema])
@limiter.limit("5/minute")
def get_shading_elements(
    request: Request,
    bt_number: str,
    record_id: str | None = None,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
) -> list[ShadeGroupSchema]:
    """Return a list of all the Shading Elements from a Project's Honeybee-Model."""
    logger.info(f"get_shading_elements({bt_number=}, {record_id=}, {force_refresh=})")

    hb_model = load_hb_model(db, bt_number, record_id, force_refresh)
    shading = get_shading_elements_from_model(hb_model)
    return shading


@router.get("/{bt_number}/model_data", response_model=CombinedModelDataSchema)
@limiter.limit("5/minute")
def get_combined_model_data(
    request: Request,
    bt_number: str,
    record_id: str | None = None,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
) -> CombinedModelDataSchema:
    """Return all 3D model viewer data in a single response.

    This endpoint combines faces, spaces, sun_path, hot_water_systems,
    ventilation_systems, and shading_elements into one request, reducing
    HTTP round trips from 6 to 1 and loading the model only once.
    """
    logger.info(f"get_combined_model_data({bt_number=}, {record_id=}, {force_refresh=})")

    # Load the model once (this is the expensive operation)
    hb_model = load_hb_model(db, bt_number, record_id, force_refresh)

    # Extract all data from the single model load
    faces = get_faces_from_model(hb_model)
    spaces = get_spaces_from_model(hb_model)
    hot_water_systems = get_hot_water_systems_from_model(hb_model)
    ventilation_systems = get_ventilation_systems_from_model(hb_model)
    shading_elements = get_shading_elements_from_model(hb_model)

    # Sun path requires EPW data (separate from HB model)
    try:
        epw = load_epw_object(db, bt_number)
        sun_path = get_sun_path_from_model(epw)
    except Exception as e:
        logger.warning(f"Could not load sun path data: {e}")
        sun_path = None

    return CombinedModelDataSchema(
        faces=faces,
        spaces=spaces,
        sun_path=sun_path,
        hot_water_systems=hot_water_systems,
        ventilation_systems=ventilation_systems,
        shading_elements=shading_elements,
    )
