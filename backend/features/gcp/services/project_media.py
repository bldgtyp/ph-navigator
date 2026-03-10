# -*- Python Version: 3.11 -*-

import logging

from db_entities.app.project import Project
from db_entities.assembly.material_datasheet import MaterialDatasheet
from db_entities.assembly.material_photo import MaterialPhoto
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class ProjectNotFoundException(Exception):
    """Custom exception for missing project."""

    def __init__(self, bt_number: str):
        self.message = f"Project with bt_number {bt_number} not found."
        logger.error(self.message)
        super().__init__(self.message)


def get_project_by_bt_number(db: Session, bt_number: str) -> Project:
    """Get a project by its bt_number from the database."""
    logger.info(f"get_project_by_bt_number({bt_number=})")

    project = db.query(Project).filter(Project.bt_number == bt_number).first()
    if not project:
        raise ProjectNotFoundException(bt_number)
    return project


def get_all_segment_ids_for_project(db: Session, bt_number: str) -> list[int]:
    """Get all segment IDs for a project by traversing assemblies -> layers -> segments."""
    logger.info(f"get_all_segment_ids_for_project({bt_number=})")

    project = get_project_by_bt_number(db, bt_number)
    segment_ids = []
    for assembly in project.assemblies:
        for layer in assembly.layers:
            for segment in layer.segments:
                segment_ids.append(segment.id)
    return segment_ids


def get_project_site_photos(
    db: Session, bt_number: str
) -> dict[int, list[MaterialPhoto]]:
    """Get all site photos for a project, grouped by segment ID.

    Args:
        db: Database session
        bt_number: The project's bt_number

    Returns:
        Dict mapping segment_id -> list of MaterialPhoto objects
    """
    logger.info(f"get_project_site_photos({bt_number=})")

    segment_ids = get_all_segment_ids_for_project(db, bt_number)
    if not segment_ids:
        return {}

    # Batch query all photos for these segments
    photos = (
        db.query(MaterialPhoto).filter(MaterialPhoto.segment_id.in_(segment_ids)).all()
    )

    # Group by segment_id
    result: dict[int, list[MaterialPhoto]] = {}
    for photo in photos:
        if photo.segment_id not in result:
            result[photo.segment_id] = []
        result[photo.segment_id].append(photo)

    return result


def get_project_datasheets(
    db: Session, bt_number: str
) -> dict[int, list[MaterialDatasheet]]:
    """Get all datasheets for a project, grouped by segment ID.

    Args:
        db: Database session
        bt_number: The project's bt_number

    Returns:
        Dict mapping segment_id -> list of MaterialDatasheet objects
    """
    logger.info(f"get_project_datasheets({bt_number=})")

    segment_ids = get_all_segment_ids_for_project(db, bt_number)
    if not segment_ids:
        return {}

    # Batch query all datasheets for these segments
    datasheets = (
        db.query(MaterialDatasheet)
        .filter(MaterialDatasheet.segment_id.in_(segment_ids))
        .all()
    )

    # Group by segment_id
    result: dict[int, list[MaterialDatasheet]] = {}
    for datasheet in datasheets:
        if datasheet.segment_id not in result:
            result[datasheet.segment_id] = []
        result[datasheet.segment_id].append(datasheet)

    return result
