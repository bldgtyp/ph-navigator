# -*- Python Version: 3.11 (Render.com) -*-

from fastapi import HTTPException
from sqlalchemy.orm import Session

from db_entities.airtable.at_table import AirTableTable
from project.services import get_project_by_bt_number


async def get_at_base_id_by_project_id(project_bt_num: int, db: Session) -> str:
    """Get the Airtable Base ID by the project ID."""
    project = await get_project_by_bt_number(db, project_bt_num)
    if not project:
        raise HTTPException(
            status_code=404, detail=f"Project {project_bt_num} not found"
        )
    return project.airtable_base_ref


async def get_at_table_id_by_project_id(
    project_bt_num: int, table_name: str, db: Session
) -> str:
    """Get the Airtable Table ID by the project ID and table name."""
    project = await get_project_by_bt_number(db, project_bt_num)
    if not project:
        raise HTTPException(
            status_code=404, detail=f"Project {project_bt_num} not found"
        )

    table = (
        db.query(AirTableTable)
        .filter(
            AirTableTable.parent_base_id == project.id,
            AirTableTable.name == table_name.upper(),
        )
        .first()
    )

    if not table:
        raise HTTPException(status_code=404, detail=f"Table {table_name} not found")

    return str(table.airtable_ref)
