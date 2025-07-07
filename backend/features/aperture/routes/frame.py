# -*- Python Version: 3.11 -*-

import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from db_entities.aperture.aperture_frame import ApertureElementFrame
from features.air_table.services import get_all_frames_from_airtable
from features.aperture.schemas.frame import ApertureElementFrameSchema
from features.aperture.services.frame import add_frames, purge_unused_frames

router = APIRouter(
    prefix="/aperture",
    tags=["aperture"],
)

logger = logging.getLogger(__name__)


@router.get("/get-frames", response_model=list[ApertureElementFrameSchema])
def get_frames_route(
    db: Session = Depends(get_db),
) -> list[ApertureElementFrameSchema]:
    """Return all of the frames in the database."""
    logger.info(f"aperture/get_frames_route()")

    frames = db.query(ApertureElementFrame).all()
    return [ApertureElementFrameSchema.from_orm(frame) for frame in frames]


@router.get("/refresh-db-frames-from-air-table")
def refresh_db_frames_from_air_table_route(
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Load all of the records from AirTable into the Database."""
    logger.info(f"assembly/refresh_db_frames_from_air_table_route()")

    frames = get_all_frames_from_airtable()
    purge_unused_frames(db)
    number_added, number_updated = add_frames(db, frames)

    return JSONResponse(
        content={
            "message": "Frames loaded successfully from AirTable",
            "frames_number_added": number_added,
            "frames_number_updated": number_updated,
            "frame_total_count": len(frames),
        },
        status_code=200,
    )


@router.get("/load-all-frames-from-airtable", response_model=list[ApertureElementFrameSchema])
def load_all_frames_from_airtable_route(
    db: Session = Depends(get_db),
) -> list[ApertureElementFrameSchema]:
    """Return all of the frames in the database."""
    logger.info(f"assembly/load_all_frames_from_airtable_route()")

    frames = get_all_frames_from_airtable()
    return [ApertureElementFrameSchema.from_orm(frame) for frame in frames]
