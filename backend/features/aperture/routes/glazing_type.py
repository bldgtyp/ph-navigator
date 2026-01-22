# -*- Python Version: 3.11 -*-

import logging

from config import limiter
from database import get_db
from db_entities.aperture.glazing_type import ApertureGlazingType
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from features.air_table.services import get_all_glazing_types_from_airtable
from features.aperture.schemas.glazing_type import GlazingTypeSchema
from features.aperture.services.glazing_type import (
    add_glazing_types,
    purge_unused_glazing_types,
)
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/aperture",
    tags=["aperture"],
)

logger = logging.getLogger(__name__)


@router.get("/get-glazing-types", response_model=list[GlazingTypeSchema])
def get_glazing_types_route(
    db: Session = Depends(get_db),
) -> list[GlazingTypeSchema]:
    """Return all of the glazing types in the database."""
    logger.info(f"aperture/get_glazing_types_route()")

    glazing_types = db.query(ApertureGlazingType).all()
    return [GlazingTypeSchema.from_orm(glazing) for glazing in glazing_types]


@router.get("/refresh-db-glazing-types-from-air-table")
def refresh_db_glazing_types_from_air_table_route(
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Load all of the records from AirTable into the Database."""
    logger.info(f"assembly/refresh_db_glazing_types_from_air_table_route()")

    glazings = get_all_glazing_types_from_airtable()
    purge_unused_glazing_types(db)
    number_added, number_updated = add_glazing_types(db, glazings)

    return JSONResponse(
        content={
            "message": "Glazing-Types loaded successfully from AirTable",
            "types_added": number_added,
            "types_updated": number_updated,
            "types_total_count": len(glazings),
        },
        status_code=200,
    )


@router.get(
    "/load-all-glazing-types-from-airtable", response_model=list[GlazingTypeSchema]
)
def load_all_glazing_types_from_airtable_route(
    db: Session = Depends(get_db),
) -> list[GlazingTypeSchema]:
    """Return all of the glazing types in the database."""
    logger.info(f"assembly/load_all_glazing_types_from_airtable_route()")

    glazing_types = get_all_glazing_types_from_airtable()
    return [GlazingTypeSchema.from_orm(glazing_type) for glazing_type in glazing_types]
