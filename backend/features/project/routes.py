# -*- Python Version: 3.11 (Render.com) -*-

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from features.project.schema import ProjectSchema
from features.project.services import get_project_by_bt_number

logger = logging.getLogger()

router = APIRouter(
    prefix="/project",
    tags=["project"],
)


@router.get("/{project_bt_num}", response_model=ProjectSchema)
@limiter.limit("100/hour")
async def project(
    request: Request,
    project_bt_num: int,
    db: Session = Depends(get_db),
) -> ProjectSchema:
    """Return a project by its BuildingType Number."""
    logger.info(f"project({project_bt_num=})")
    project = await get_project_by_bt_number(db, project_bt_num)
    if not project:
        raise HTTPException(
            status_code=404, detail=f"Project {project_bt_num} not found"
        )
    return ProjectSchema.model_validate(project)
