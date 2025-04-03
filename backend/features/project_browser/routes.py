# -*- Python Version: 3.11 (Render.com) -*-

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from db_entities.user import User
from features.auth.services import get_current_active_user
from features.project.schema import ProjectSchema
from features.project.services import get_projects

router = APIRouter(
    prefix="/project_browser",
    tags=["project_browser"],
)


@router.get("/get_project_card_data", response_model=list[ProjectSchema])
async def get_project_card_data(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
) -> list[ProjectSchema]:
    """Return summary-data for each of the user's projects for the project browser."""
    logging.info(f"get_project_card_data({current_user.id=})")
    projects = await get_projects(db, current_user.all_project_ids)
    return [ProjectSchema.model_validate(p) for p in projects]
