# -*- Python Version: 3.11 -*-

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pyairtable import Api, Table
from pyairtable.api.types import RecordDict
from sqlalchemy.orm import Session

from database import get_db
from db_entities.airtable.at_base import AirTableBase
from db_entities.app.project import Project
from features.air_table.schema import AddAirTableBaseRequest
from features.air_table.services import (
    add_tables_to_base,
    get_airtable_base_ref,
    get_airtable_table_ref,
    get_base_table_schemas,
)

router = APIRouter(
    prefix="/air_table",
    tags=["air_table"],
)


logger = logging.getLogger(__name__)


# TODO: Return Pydantic Object
@router.get("/config/{bt_number}")
async def get_project_config(bt_number: str, db: Session = Depends(get_db)) -> list[RecordDict]:
    logger.info(f"/air_table/get_project_config({bt_number=})")

    # Get the Project
    project = db.query(Project).filter_by(bt_number=bt_number).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {bt_number} not found.",
        )

    # Get the AirTable base
    if not project.airtable_base:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AirTable base not found for Project {bt_number}.",
        )

    # Check the AirTable access token
    if not project.airtable_base.airtable_access_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AirTable access token not found for Project {bt_number}.",
        )

    api = Api(project.airtable_base.airtable_access_token)
    at_base_id = await get_airtable_base_ref(db, bt_number)
    at_table_id = await get_airtable_table_ref(db, bt_number, "config")
    table = api.table(at_base_id, at_table_id)
    return table.all()


# TODO: Return Pydantic Object
@router.get("/{bt_number}/{at_table_name}")
async def get_project_air_table_records_from_table(
    bt_number: str, at_table_name: str, db: Session = Depends(get_db)
) -> list[RecordDict]:
    """Return all of the records from a specified Table (name), for a specified Project (bldgtyp-number)."""
    logger.info(f"air_table/get_project_air_table_records_from_table({bt_number=}, {at_table_name=})")

    # Get the Project
    project = db.query(Project).filter_by(bt_number=bt_number).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {bt_number} not found.",
        )

    # Get the AirTable base
    if not project.airtable_base:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AirTable base not found for Project {bt_number}.",
        )

    # Check the AirTable access token
    if not project.airtable_base.airtable_access_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AirTable access token not found for Project {bt_number}.",
        )

    api = Api(project.airtable_base.airtable_access_token)
    at_base_id = await get_airtable_base_ref(db, bt_number)
    at_table_id = await get_airtable_table_ref(db, bt_number, at_table_name)
    table = api.table(at_base_id, at_table_id)
    return table.all()


# TODO: Return Pydantic Object
@router.post("/connect-AT-base-to-project", status_code=status.HTTP_201_CREATED)
async def connect_at_base_to_project(
    request: AddAirTableBaseRequest,
    db: Session = Depends(get_db),
):
    """Connect an AirTable Base to a Project."""
    logger.info(f"air_table/connect_at_base_to_project({request=})")

    # Get the Project
    project = db.query(Project).filter_by(bt_number=request.bt_number).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {request.bt_number} not found.",
        )

    # Validate the AirTable Base
    try:
        # -- Get the AirTable base
        api = Api(request.airtable_base_api_key)
        at_base = api.base(request.airtable_base_ref)
        logger.info(f"New AirTable base info: {at_base}")

        tables: list[Table] = await get_base_table_schemas(at_base)
        logger.info(f"Tables in the AirTable base: [{len(tables)}]")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect to AirTable base: {str(e)}",
        )

    # Check if the base already exists in the database
    existing_base = db.query(AirTableBase).filter_by(id=at_base.id).first()
    if existing_base:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This AirTable base is already connected.",
        )

    # Create and Save the new AirTable-Base to the database
    new_base = AirTableBase(id=at_base.id)
    new_base.airtable_access_token = request.airtable_base_api_key
    db.add(new_base)
    db.commit()
    db.refresh(new_base)

    # Create the new AirTable-Tables and add them to the Base
    await add_tables_to_base(db, new_base, tables)
    db.refresh(new_base)

    # Connect the AirTable base to the Project
    project.airtable_base = new_base
    db.commit()
    db.refresh(project)

    return {"message": "AirTable base connected successfully.", "base_id": new_base.id}
