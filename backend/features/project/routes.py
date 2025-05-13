# -*- Python Version: 3.11 (Render.com) -*-

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from db_entities.app.user import User
from db_entities.app.project import Project 
from db_entities.airtable.at_base import AirTableBase   
from features.auth.services import get_current_active_user
from features.project.schema import ProjectSchema, ProjectCreateSchema
from features.project.services import get_project_by_bt_number

logger = logging.getLogger()

router = APIRouter(
    prefix="/project",
    tags=["project"],
)


@router.get("/{bt_number}", response_model=ProjectSchema)
@limiter.limit("100/hour")
async def project(
    request: Request,
    bt_number: int,
    db: Session = Depends(get_db),
) -> ProjectSchema:
    """Return a project by its BuildingType Number."""
    logger.info(f"project({bt_number=})")
    
    project = await get_project_by_bt_number(db, bt_number)
    if not project:
        raise HTTPException(
            status_code=404, detail=f"Project {bt_number} not found"
        )
    return ProjectSchema.from_orm(project)


@router.get("/{bt_number}/get_settings", response_model=ProjectSchema, status_code=status.HTTP_200_OK)
async def get_project_settings(
    request: Request,
    bt_number: int,
    db: Session = Depends(get_db),
):
    # Get the project from the database
    project = await get_project_by_bt_number(db, bt_number)

    if not project:
        HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with bt_number {bt_number} not found.",
        )
        
    return ProjectSchema.from_orm(project)


@router.patch("/{bt_number}/update_settings", response_model=ProjectSchema, status_code=status.HTTP_200_OK)
async def update_project_settings(
    request: Request,
    bt_number: int,
    project_settings_data: ProjectCreateSchema,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    # Get the project from the database
    project = await get_project_by_bt_number(db, bt_number)

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with bt_number {bt_number} not found.",
        )

    # Check if the current user is the owner of the project
    if project.owner != current_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this project.",
        )
    
    # Update the project settings
    project.name = project_settings_data.name
    project.bt_number = project_settings_data.bt_number
    project.phius_number = project_settings_data.phius_number
    project.phius_dropbox_url = project_settings_data.phius_dropbox_url

    db.commit()

    return ProjectSchema.from_orm(project)


@router.post("/create_new_project", response_model=ProjectSchema, status_code=status.HTTP_201_CREATED)
async def create_new_project(
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
        users=[current_user]
    )

    # Add the project to the database
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    return ProjectSchema.from_orm(new_project)

