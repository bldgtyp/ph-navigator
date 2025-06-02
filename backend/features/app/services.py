# -*- Python Version: 3.11 -*-

import logging

from sqlalchemy.orm import Session

from db_entities.app import Project, User
from features.app.schema import ProjectCreateSchema

logger = logging.getLogger(__name__)


class ProjectNotFoundException(Exception):
    """Custom exception for missing project."""

    def __init__(self, bt_number: str):
        logger.error(f"Project {bt_number} not found.")
        super().__init__(f"Project {bt_number} not found.")


class ProjectAlreadyExistsException(Exception):
    """Custom exception for existing project."""

    def __init__(self, bt_number: str):
        logger.error(f"Project with BuildingType Number {bt_number} already exists.")
        super().__init__(f"Project with BuildingType Number {bt_number} already exists.")


def get_projects(db: Session, project_ids: list[int]) -> list[Project]:
    """Return a list of projects by their IDs."""
    logger.info(f"get_projects({project_ids=})")
    
    return db.query(Project).filter(Project.id.in_(project_ids)).all()


def get_project_by_bt_number(db: Session, bt_number: str) -> Project:
    """Return a project by its BuildingType Number."""
    logger.info(f"get_project_by_bt_number({bt_number=})")

    project = db.query(Project).filter(Project.bt_number == bt_number).first()
    if not project:
        raise ProjectNotFoundException(bt_number)
    return project


def get_project_by_id(db: Session, project_id: int) -> Project:
    """Return a project by its ID."""
    logger.info(f"get_project_by_id({project_id=})")
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise ProjectNotFoundException(f"Project with ID {project_id} not found.")
    return project


def create_new_user(
    db: Session,
    username: str,
    email: str,
    hashed_password: str,
) -> User:
    """Add a new user to the database."""
    logger.info(f"create_new_user({username=}, {email=})")

    new_user = User(
        username=username,
        email=email,
        hashed_password=hashed_password,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def create_new_project(
    db: Session,
    name: str,
    owner_id: int,
    bt_number: str,
    phius_number: str | None = None,
    phius_dropbox_url: str | None = None,
    airtable_base_id: str | None = None,
) -> Project:
    """Add a new project to the database."""
    logger.info(f"create_new_project({name=}, {owner_id=}, {bt_number=})")

    # -- Check if project with same bt_number already exists
    try:
        get_project_by_bt_number(db, bt_number)
        raise ProjectAlreadyExistsException(bt_number)
    except ProjectNotFoundException:
        # Project does not exist, continue with creation
        pass

    # -- Create a new Project instance
    new_project = Project(
        bt_number=bt_number,
        name=name,
        phius_number=phius_number,
        phius_dropbox_url=phius_dropbox_url,
        owner_id=owner_id,
        airtable_base_id=airtable_base_id,
    )

    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    db.refresh(new_project.owner)

    return new_project


def update_project_settings(db: Session, project: Project, project_settings_data: ProjectCreateSchema) -> Project:
    """Update the project settings in the database."""
    logger.info(f"update_project_settings({project.id=}, {project_settings_data=})")

    # Update the project settings
    project.name = project_settings_data.name
    project.bt_number = project_settings_data.bt_number
    project.phius_number = project_settings_data.phius_number
    project.phius_dropbox_url = project_settings_data.phius_dropbox_url

    db.commit()
    db.refresh(project)

    return project
