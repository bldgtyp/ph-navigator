# -*- Python Version: 3.11 (Render.com) -*-

import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pyairtable import Api
from pyairtable.api.types import RecordDict
from sqlalchemy.orm import Session

from config import limiter, settings
from database import get_db
from features.assembly.schema import AirTableMaterialSchema, AssemblySchema, MaterialSchema
from db_entities.assembly import Material, Assembly

router = APIRouter(
    prefix="/assembly",
    tags=["assembly"],
)

logger = logging.getLogger(__name__)



@router.get("/load_materials_from_air_table")
async def load_materials_from_air_table(db: Session = Depends(get_db)) -> JSONResponse:
    """Load all of the records from the AirTable into the Database."""
    logger.info(f"load_materials_from_air_table()")
    
    # -- Go get the Materials from AirTable
    api = Api(settings.AIRTABLE_MATERIAL_GET_TOKEN)
    table = api.table(settings.AIRTABLE_MATERIAL_BASE_ID, settings.AIRTABLE_MATERIAL_TABLE_ID)
    material_records: list[RecordDict] = table.all()

    # -- Convert the records to AirTableMaterialSchema for validation
    materials: list[AirTableMaterialSchema] = []
    for record in material_records:
        d = {}
        d = d | record["fields"]
        d["id"] = record["id"]
        new_mat = AirTableMaterialSchema(**d)
        materials.append(new_mat)
    
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
            status_code=200
        )


@router.get("/get_materials")
async def get_materials_from_air_table(db: Session = Depends(get_db)) -> list[MaterialSchema]:
    """Return all of the records from the AirTable Materials DataBase."""
    logger.info(f"get_materials()")
    materials = db.query(Material).all()
    return [MaterialSchema.from_orm(material) for material in materials]



@router.get("/get_assemblies")
async def get_assemblies(db: Session = Depends(get_db)) -> list[AssemblySchema]:
    """Get all assemblies from the database."""
    logger.info(f"get_assemblies()")
    assemblies = db.query(Assembly).all()
    return [AssemblySchema.from_orm(assembly) for assembly in assemblies]