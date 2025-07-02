# -*- Python Version: 3.11 -*-

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from config import limiter
from database import get_db

from features.aperture.schemas import ApertureSchema
from features.aperture.services.aperture import get_apertures_by_project_bt

router = APIRouter(
    prefix="/aperture",
    tags=["aperture"],
)

logger = logging.getLogger(__name__)

@router.get("/get-apertures/{bt_number}", response_model=list[ApertureSchema])
def get_project_apertures_route(request: Request, bt_number: str, db: Session = Depends(get_db)) -> list[ApertureSchema]:
    logger.info(f"get_project_apertures_route({bt_number})")
    
    try:
        apertures = get_apertures_by_project_bt(db, bt_number)
        return [ApertureSchema.from_orm(aperture) for aperture in apertures]
    except Exception as e:
        msg = f"Error retrieving apertures for project {bt_number=}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)  
