# python3.11 (Render.com)

from sqlalchemy.orm import Session

from db_entities.project import Project


async def get_projects(db: Session, project_ids: list[int]) -> list[Project]:
    return db.query(Project).filter(Project.id.in_(project_ids)).all()


async def get_project_by_bt_number(
    db: Session, project_bt_number: int
) -> Project | None:
    """Return a project by its BuildingType Number."""
    return db.query(Project).filter(Project.bt_number == project_bt_number).first()


