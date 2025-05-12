# -*- Python Version: 3.11 (Render.com) -*-

import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pyairtable import Api
from pyairtable.api.types import RecordDict
from sqlalchemy.orm import Session

from config import limiter, settings
from database import get_db
from db_entities.assembly import Material, Segment
from features.assembly.schemas.material import AirTableMaterialSchema, MaterialSchema

router = APIRouter(
    prefix="/assembly",
    tags=["assembly"],
)

logger = logging.getLogger(__name__)


@router.get("/refresh_db_materials_from_air_table")
async def refresh_db_materials_from_air_table(
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Load all of the records from the AirTable into the Database."""
    logger.info(f"refresh_db_materials_from_air_table()")

    # -- Go get the Materials from AirTable
    api = Api(settings.AIRTABLE_MATERIAL_GET_TOKEN)
    table = api.table(
        settings.AIRTABLE_MATERIAL_BASE_ID, settings.AIRTABLE_MATERIAL_TABLE_ID
    )
    material_records: list[RecordDict] = table.all()

    # -- Convert the records to AirTableMaterialSchema for validation
    materials: list[AirTableMaterialSchema] = []
    for record in material_records:
        d = {}
        d = d | record["fields"]
        d["id"] = record["id"]
        new_mat = AirTableMaterialSchema(**d)
        materials.append(new_mat)

    # -- Remove all of the existing materials which are not used by any of the Segments
    # Get all existing materials
    existing_materials = db.query(Material).all()
    existing_material_ids = {material.id for material in existing_materials}
    # Get all segment material IDs
    segment_material_ids = {segment.material.id for segment in db.query(Segment).all()}
    # Find materials that are not used by any segments
    unused_material_ids = existing_material_ids - segment_material_ids
    # Delete unused materials
    for material_id in unused_material_ids:
        material = db.query(Material).filter_by(id=material_id).first()
        if material:
            db.delete(material)
            logger.info(f"Deleted unused material with ID: {material_id}")
    db.commit()

    # -- Add the Materials to the database
    materials_added = 0
    materials_updated = 0
    for material in materials:
        # Check if the material already exists
        existing_material = db.query(Material).filter_by(id=material.id).first()
        if existing_material:
            # Update the existing record
            for key, value in material.dict().items():
                setattr(existing_material, key, value)
            materials_updated += 1
            logger.info(f"Updated material with ID: {material.id}")
        else:
            # Add a new record
            db_material = Material(**material.dict())
            db.add(db_material)
            logger.info(f"Added new material with ID: {material.id}")
            materials_added += 1

    db.commit()

    return JSONResponse(
        content={
            "message": "Materials loaded successfully",
            "materials_number_added": materials_added,
            "materials_number_updated": materials_updated,
            "material_total_count": len(materials),
        },
        status_code=200,
    )


@router.get("/get_materials")
async def get_materials_from_air_table(
    db: Session = Depends(get_db),
) -> list[MaterialSchema]:
    """Return all of the records from the AirTable Materials DataBase."""
    logger.info(f"get_materials_from_air_table()")

    materials = db.query(Material).all()
    return [MaterialSchema.from_orm(material) for material in materials]
