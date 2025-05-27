# -*- Python Version: 3.11 (Render.com) -*-

from sqlalchemy.orm import Session

from db_entities.app import Project, User


class ProjectNotFoundException(Exception):
    """Custom exception for missing project."""

    def __init__(self, bt_number: str):
        self.bt_number = bt_number
        super().__init__(f"Project {bt_number} not found.")


async def get_projects(db: Session, project_ids: list[int]) -> list[Project]:
    return db.query(Project).filter(Project.id.in_(project_ids)).all()


def get_project_by_bt_number(db: Session, project_bt_number: str) -> Project:
    """Return a project by its BuildingType Number."""

    project = db.query(Project).filter(Project.bt_number == project_bt_number).first()
    if not project:
        raise ProjectNotFoundException(project_bt_number)
    return project


def create_new_user_in_db(
    db: Session,
    username: str,
    email: str,
    hashed_password: str,
) -> User:
    """Add a new user to the database."""
    new_user = User(
        username=username,
        email=email,
        hashed_password=hashed_password,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def create_new_project_in_db(
    db: Session,
    name: str,
    owner_id: int,
    bt_number: str | None = None,
    phius_number: str | None = None,
    phius_dropbox_url: str | None = None,
    airtable_base_id: str | None = None,
) -> Project:
    """Add a new project to the database."""
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
    return new_project
