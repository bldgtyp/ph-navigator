# -*- Python Version: 3.11 -*-

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from db_entities.app.user import User
from features.app.schema import ProjectSchema
from features.app.services import get_projects
from features.auth.services import get_current_active_user

router = APIRouter(
    prefix="/project_browser",
    tags=["project_browser"],
)

logger = logging.getLogger(__name__)


@router.get("/get-project-card-data", response_model=list[ProjectSchema])
async def get_project_card_data_route(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
) -> list[ProjectSchema]:
    """Return summary-data for each of the user's projects for the project browser."""
    logger.info(f"project_browser/get_project_card_data({current_user.id=})")

    try:
        projects = get_projects(db, current_user.all_project_ids)
        return [ProjectSchema.from_orm(p) for p in projects]
    except Exception as e:
        logger.error(f"Failed to get project card data for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve project data")
