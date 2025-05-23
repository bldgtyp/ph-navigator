# -*- Python Version: 3.11 (Render.com) -*-

import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from db_entities.assembly import Material
from features.air_table.services import get_all_material_from_airtable
from features.assembly.schemas.material import MaterialSchema
from features.assembly.services.material import (
    add_materials_to_db,
    purge_unused_materials,
)

router = APIRouter(
    prefix="/assembly",
    tags=["assembly"],
)

logger = logging.getLogger(__name__)


@router.get("/refresh_db_materials_from_air_table")
async def refresh_db_materials_from_air_table(
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Load all of the records from AirTable into the Database."""
    logger.info(f"refresh_db_materials_from_air_table()")

    materials = get_all_material_from_airtable()
    purge_unused_materials(db)
    number_added, number_updated = add_materials_to_db(db, materials)

    return JSONResponse(
        content={
            "message": "Materials loaded successfully",
            "materials_number_added": number_added,
            "materials_number_updated": number_updated,
            "material_total_count": len(materials),
        },
        status_code=200,
    )


@router.get("/get_all_materials")
async def get_all_materials(
    db: Session = Depends(get_db),
) -> list[MaterialSchema]:
    """Return all of the Materials in the database."""
    logger.info(f"get_all_materials()")

    materials = db.query(Material).all()
    return [MaterialSchema.from_orm(material) for material in materials]
