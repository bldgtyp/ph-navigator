# -*- Python Version: 3.11 -*-

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from db_entities.app.user import User
from features.app.schema import ProjectCreateSchema, ProjectSchema
from features.app.services import (
    ProjectAlreadyExistsException,
    create_new_project,
    get_project_by_bt_number,
    update_project_settings,
)
from features.auth.services import get_current_active_user

router = APIRouter(
    prefix="/project",
    tags=["project"],
)

logger = logging.getLogger()


@router.get("/{bt_number}", response_model=ProjectSchema, status_code=status.HTTP_200_OK)
def get_project_by_bt_number_route(
    request: Request,
    bt_number: str,
    db: Session = Depends(get_db),
) -> ProjectSchema:
    """Return a project by its BuildingType Number."""
    logger.info(f"project/get_project_by_bt_number_route({bt_number=})")

    try:
        project = get_project_by_bt_number(db, bt_number)
        return ProjectSchema.from_orm(project)
    except Exception as e:
        logger.error(f"Failed to get project {bt_number}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project '{bt_number}'")


@router.patch("/update-settings/{bt_number}", response_model=ProjectSchema, status_code=status.HTTP_200_OK)
def update_project_settings_route(
    request: Request,
    bt_number: str,
    project_settings_data: ProjectCreateSchema,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    logger.info(f"project/update_project_settings_route({bt_number=}, {project_settings_data=})")

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


@router.post("/create-new-project", response_model=ProjectSchema, status_code=status.HTTP_201_CREATED)
def create_new_project_route(
    request: Request,
    new_project_data: ProjectCreateSchema,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
) -> ProjectSchema:
    """Add a new project to the database."""
    logger.info(f"project/create_new_project({new_project_data=}, {current_user=})")

    try:
        project = create_new_project(
            db=db,
            name=new_project_data.name,
            owner_id=current_user.id,
            bt_number=new_project_data.bt_number,
            phius_number=new_project_data.phius_number,
        )
        return ProjectSchema.from_orm(project)
    except ProjectAlreadyExistsException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A project with bt_number '{new_project_data.bt_number}' already exists.",
        )
    except Exception as e:
        logger.error(f"Failed to create new project: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create new project: {e}")
