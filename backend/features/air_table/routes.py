# -*- Python Version: 3.11 -*-

import logging

from config import limiter
from database import get_db
from db_entities.app.project import Project
from fastapi import APIRouter, Depends, HTTPException, Request, status
from features.air_table.schema import AddAirTableBaseRequest
from features.air_table.services import (
    connect_airtable_base_to_project,
    get_airtable_table_ref_by_name,
    get_project_airtable_base_ref,
)
from features.app.services import get_project_by_bt_number
from pyairtable import Api
from pyairtable.api.types import RecordDict
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/air_table",
    tags=["air_table"],
)


logger = logging.getLogger(__name__)


# TODO: Return Pydantic Object. Move to Service.
@router.get("/config/{bt_number}")
@limiter.limit("10/minute")
async def get_project_config(
    request: Request,
    bt_number: str,
    db: Session = Depends(get_db),
) -> list[RecordDict]:
    logger.info(f"/air_table/get_project_config({bt_number=})")

    project = get_project_by_bt_number(db, bt_number)

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
    at_base_id = get_project_airtable_base_ref(db, bt_number)
    at_table_id = get_airtable_table_ref_by_name(db, bt_number, "config")
    table = api.table(at_base_id, at_table_id)
    return table.all()


# TODO: Return Pydantic Object
@router.get("/{bt_number}/{at_table_name}")
@limiter.limit("10/minute")
async def get_project_air_table_records_from_table(
    request: Request, bt_number: str, at_table_name: str, db: Session = Depends(get_db)
) -> list[RecordDict]:
    """Return all of the records from a specified Table (name), for a specified Project (bldgtyp-number)."""
    logger.info(
        f"air_table/get_project_air_table_records_from_table({bt_number=}, {at_table_name=})"
    )

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
    at_base_id = get_project_airtable_base_ref(db, bt_number)
    at_table_id = get_airtable_table_ref_by_name(db, bt_number, at_table_name)
    table = api.table(at_base_id, at_table_id)
    return table.all()


@router.post("/connect-AT-base-to-project", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def connect_at_base_to_project_route(
    request: Request,
    add_at_base_request: AddAirTableBaseRequest,
    db: Session = Depends(get_db),
):
    """Connect an AirTable Base to a Project."""
    logger.info(f"air_table/connect_at_base_to_project_route({add_at_base_request=})")

    try:
        db_base = connect_airtable_base_to_project(
            db,
            add_at_base_request.bt_number,
            add_at_base_request.airtable_base_api_key,
            add_at_base_request.airtable_base_ref,
        )
        db.commit()

        return {
            "message": "AirTable base connected successfully.",
            "base_id": db_base.id,
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        db.rollback()
        logger.exception("Unexpected error connecting AirTable base")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}",
        )
