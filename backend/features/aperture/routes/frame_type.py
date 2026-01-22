# -*- Python Version: 3.11 -*-

import logging

from config import limiter
from database import get_db
from db_entities.aperture.frame_type import ApertureFrameType
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from features.air_table.services import get_all_frame_types_from_airtable
from features.aperture.schemas.frame_type import FrameTypeSchema
from features.aperture.services.frame_type import (
    add_frame_types,
    purge_unused_frame_types,
)
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/aperture",
    tags=["aperture"],
)

logger = logging.getLogger(__name__)


@router.get("/get-frame-types", response_model=list[FrameTypeSchema])
def get_frame_types_route(
    db: Session = Depends(get_db),
) -> list[FrameTypeSchema]:
    """Return all of the frame-types in the database."""
    logger.info(f"aperture/get_frame_types_route()")

    frame_types = db.query(ApertureFrameType).all()
    return [FrameTypeSchema.from_orm(frame) for frame in frame_types]


@router.get("/refresh-db-frame-types-from-air-table")
def refresh_db_frame_types_from_air_table_route(
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Load all of the records from AirTable into the Database."""
    logger.info(f"assembly/refresh_db_frame_types_from_air_table_route()")

    frame_types = get_all_frame_types_from_airtable()
    purge_unused_frame_types(db)
    number_added, number_updated = add_frame_types(db, frame_types)

    return JSONResponse(
        content={
            "message": "Frames loaded successfully from AirTable",
            "types_added": number_added,
            "types_updated": number_updated,
            "types_total_count": len(frame_types),
        },
        status_code=200,
    )


@router.get("/load-all-frame-types-from-airtable", response_model=list[FrameTypeSchema])
def load_all_frame_types_from_airtable_route(
    db: Session = Depends(get_db),
) -> list[FrameTypeSchema]:
    """Return all of the frame-types in the database."""
    logger.info(f"assembly/load_all_frame_types_from_airtable_route()")

    frame_types = get_all_frame_types_from_airtable()
    return [FrameTypeSchema.from_orm(frame) for frame in frame_types]
