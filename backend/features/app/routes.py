# -*- Python Version: 3.11 -*-

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from db_entities.app.project import Project
from db_entities.app.user import User
from features.app.schema import ProjectCreateSchema, ProjectSchema
from features.app.services import get_project_by_bt_number, update_project_settings
from features.auth.services import get_current_active_user

router = APIRouter(
    prefix="/project",
    tags=["project"],
)

logger = logging.getLogger()


@router.get("/{bt_number}", response_model=ProjectSchema, status_code=status.HTTP_200_OK)
async def get_project_route(
    request: Request,
    bt_number: str,
    db: Session = Depends(get_db),
) -> ProjectSchema:
    """Return a project by its BuildingType Number."""
    logger.info(f"project({bt_number=})")

    try:
        project = get_project_by_bt_number(db, bt_number)
        return ProjectSchema.from_orm(project)
    except Exception as e:
        logger.error(f"Failed to get project {bt_number}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project '{bt_number}'")


@router.patch("/update-settings/{bt_number}", response_model=ProjectSchema, status_code=status.HTTP_200_OK)
async def update_project_settings_route(
    request: Request,
    bt_number: str,
    project_settings_data: ProjectCreateSchema,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):

    try:
        project = get_project_by_bt_number(db, bt_number)

        # TODO: is there a better way to do this?
        # Check if the current user is the owner of the project
        if project.owner != current_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update this project.",
            )

        project = update_project_settings(db, project, project_settings_data)

        return ProjectSchema.from_orm(project)
    except Exception as e:
        logger.error(f"Failed to update project settings for {bt_number}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update project settings for '{bt_number}'")


# TODO move to Service....
@router.post("/create-new-project", response_model=ProjectSchema, status_code=status.HTTP_201_CREATED)
async def create_new_project_route(
    request: Request,
    new_project_data: ProjectCreateSchema,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
) -> ProjectSchema:
    """Add a new project to the database."""
    logger.info(f"create_new_project()")

    # Check if a project with the same bt_number already exists
    existing_project = db.query(Project).filter_by(bt_number=new_project_data.bt_number).first()
    if existing_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A project with bt_number '{new_project_data.bt_number}' already exists.",
        )

    # Create a new Project instance
    new_project = Project(
        name=new_project_data.name,
        bt_number=new_project_data.bt_number,
        phius_number=new_project_data.phius_number,
        owner=current_user,
        airtable_base=None,
        users=[current_user],
    )

    # Add the project to the database
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    return ProjectSchema.from_orm(new_project)
