# -*- Python Version: 3.11 (Render.com) -*-

import logging

from fastapi import APIRouter, Depends
from pyairtable import Api
from pyairtable.api.types import RecordDict
from sqlalchemy.orm import Session

from config import limiter, settings
from database import get_db
from db_entities.assembly.material import Material
from features.air_table.services import get_airtable_base_ref, get_airtable_table_ref

router = APIRouter(
    prefix="/air_table",
    tags=["air_table"],
)


logger = logging.getLogger(__name__)


@router.get("/{project_bt_num}/config")
async def get_project_config(
    project_bt_num: int, db: Session = Depends(get_db)
) -> list[RecordDict]:
    logger.info(f"get_project_config({project_bt_num=})")
    api = Api(settings.AIRTABLE_GET_TOKEN)
    at_base_id = await get_airtable_base_ref(db, project_bt_num)
    at_table_id = await get_airtable_table_ref(db, project_bt_num, "config")
    table = api.table(at_base_id, at_table_id)
    return table.all()


@router.get("/{project_bt_num}/{at_table_name}")
async def get_project_air_table_records_from_table(
    project_bt_num: int, at_table_name: str, db: Session = Depends(get_db)
) -> list[RecordDict]:
    """Return all of the records from a specified Table (name), for a specified Project (bldgtyp-number)."""
    logger.info(
        f"get_project_air_table_records_from_table({project_bt_num=}, {at_table_name=})"
    )
    api = Api(settings.AIRTABLE_GET_TOKEN)
    at_base_id = await get_airtable_base_ref(db, project_bt_num)
    at_table_id = await get_airtable_table_ref(db, project_bt_num, at_table_name)
    table = api.table(at_base_id, at_table_id)
    return table.all()
