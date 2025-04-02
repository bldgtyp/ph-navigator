# python3.11 (Render.com)

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.services import get_current_active_user
from database import get_db
from db_entities.user import User
from project.schema import ProjectSchema
from project.services import get_projects

router = APIRouter(
    prefix="/project_browser",
    tags=["project_browser"],
)

@router.get("/get_project_card_data", response_model=list[ProjectSchema])
async def get_project_card_data(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
) -> list[ProjectSchema]:
    """Return the current user's project card data."""
    logging.info(f"get_project_card_data(current_user.id={current_user.id})")
    projects = await get_projects(db, current_user.all_project_ids)
    return [ProjectSchema.model_validate(p) for p in projects]