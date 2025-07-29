# -*- Python Version: 3.11 -*-

import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from db_entities.aperture.aperture_glazing import ApertureElementGlazing
from features.air_table.services import get_all_glazings_from_airtable
from features.aperture.schemas.glazing import ApertureElementGlazingSchema
from features.aperture.services.glazing import add_glazings, purge_unused_glazings

router = APIRouter(
    prefix="/aperture",
    tags=["aperture"],
)

logger = logging.getLogger(__name__)


@router.get("/get-glazings", response_model=list[ApertureElementGlazingSchema])
def get_glazings_route(
    db: Session = Depends(get_db),
) -> list[ApertureElementGlazingSchema]:
    """Return all of the glazings in the database."""
    logger.info(f"aperture/get_glazings_route()")

    glazings = db.query(ApertureElementGlazing).all()
    return [ApertureElementGlazingSchema.from_orm(glazing) for glazing in glazings]


@router.get("/refresh-db-glazings-from-air-table")
def refresh_db_glazings_from_air_table_route(
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Load all of the records from AirTable into the Database."""
    logger.info(f"assembly/refresh_db_glazings_from_air_table_route()")

    glazings = get_all_glazings_from_airtable()
    purge_unused_glazings(db)
    number_added, number_updated = add_glazings(db, glazings)

    return JSONResponse(
        content={
            "message": "Glazings loaded successfully from AirTable",
            "glazings_number_added": number_added,
            "glazings_number_updated": number_updated,
            "glazing_total_count": len(glazings),
        },
        status_code=200,
    )


@router.get("/load-all-glazings-from-airtable", response_model=list[ApertureElementGlazingSchema])
def load_all_glazings_from_airtable_route(
    db: Session = Depends(get_db),
) -> list[ApertureElementGlazingSchema]:
    """Return all of the glazings in the database."""
    logger.info(f"assembly/load_all_glazings_from_airtable_route()")

    glazings = get_all_glazings_from_airtable()
    return [ApertureElementGlazingSchema.from_orm(glazing) for glazing in glazings]
