# python3.11 (Render.com)

import os

from dotenv import load_dotenv
from fastapi import APIRouter, Depends
from pyairtable import Api
from pyairtable.api.types import RecordDict
from sqlalchemy.orm import Session

from air_table.services import (get_at_base_id_by_project_id,
                                get_at_table_id_by_project_id)
from database import get_db
from rate_limiting import limiter

load_dotenv()

AIRTABLE_API_KEY = str(os.getenv("AIRTABLE_API_KEY"))
AIRTABLE_BASE_ID = str(os.getenv("AIRTABLE_BASE_ID"))
AIRTABLE_TABLE_NAME = "tblapLjAFgm7RIllz"
AIRTABLE_GET_TOKEN = str(os.getenv("AIRTABLE_GET_TOKEN"))


router = APIRouter(
    prefix="/air_table",
    tags=["air_table"],
)

@router.get("/{project_bt_num}/config")
async def get_project_config(
    project_bt_num: int, db: Session = Depends(get_db)
) -> list[RecordDict]:
    api = Api(AIRTABLE_GET_TOKEN)
    at_base_id = await get_at_base_id_by_project_id(project_bt_num, db)
    at_table_id = await get_at_table_id_by_project_id(project_bt_num, "config", db)
    table = api.table(at_base_id, at_table_id)
    return table.all()


@router.get("/{project_bt_num}/fans")
async def get_fans(
    project_bt_num: int, db: Session = Depends(get_db)
) -> list[RecordDict]:
    api = Api(AIRTABLE_GET_TOKEN)
    at_base_id = await get_at_base_id_by_project_id(project_bt_num, db)
    at_table_id = await get_at_table_id_by_project_id(project_bt_num, "fans", db)
    table = api.table(at_base_id, at_table_id)
    return table.all()
