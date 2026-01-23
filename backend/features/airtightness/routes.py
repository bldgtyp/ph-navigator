# -*- Python Version: 3.11 -*-

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from features.airtightness.schemas import AirTightnessDataResponse
from features.airtightness.services import get_model_airtightness_data
from features.hb_model.services.hb_model import load_hb_model

router = APIRouter(
    prefix="/airtightness",
    tags=["airtightness"],
)

logger = logging.getLogger(__name__)


@router.get("/get-airtightness-data/{bt_number}", response_model=AirTightnessDataResponse)
def get_airtightness_data(
    request: Request,
    bt_number: str,
    db: Session = Depends(get_db),
) -> AirTightnessDataResponse:
    """Fetches airtightness data for a given project."""
    logger.info(f"get_airtightness_data {bt_number=}")

    try:
        hb_model = load_hb_model(db, bt_number)
        airtightness_data = get_model_airtightness_data(hb_model)
        return AirTightnessDataResponse(**airtightness_data)
    except Exception as e:
        msg = f"Error fetching airtightness data for project {bt_number}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)
