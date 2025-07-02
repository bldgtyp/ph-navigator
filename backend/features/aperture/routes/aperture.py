# -*- Python Version: 3.11 -*-

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from features.aperture.schemas import ApertureSchema

router = APIRouter(
    prefix="/aperture",
    tags=["aperture"],
)

logger = logging.getLogger(__name__)

@router.get("/get-apertures/{bt_number}", response_model=list[ApertureSchema])
def get_project_apertures_route(request: Request, bt_number: str, db: Session = Depends(get_db)) -> list[ApertureSchema]:
    logger.info(f"get_project_apertures_route({bt_number})")
    
    try:
        return []
    except Exception as e:
        msg = f"Error retrieving apertures for project {bt_number=}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)  
