# -*- Python Version: 3.11 -*-

import logging

from db_entities.aperture.aperture import Aperture
from db_entities.aperture.aperture_element import ApertureElement
from db_entities.aperture.aperture_frame import ApertureElementFrame
from db_entities.aperture.aperture_glazing import ApertureElementGlazing
from db_entities.aperture.frame_type import ApertureFrameType
from db_entities.aperture.glazing_type import ApertureGlazingType
from db_entities.app.manufacturer_filter import ProjectManufacturerFilter
from db_entities.app.project import Project
from sqlalchemy import distinct, or_
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def get_all_frame_manufacturers(db: Session) -> list[str]:
    """Get all unique frame manufacturers from the database."""
    result = (
        db.query(distinct(ApertureFrameType.manufacturer))
        .filter(
            ApertureFrameType.manufacturer.isnot(None),
            ApertureFrameType.manufacturer != "",
        )
        .all()
    )
    return sorted([r[0] for r in result])


def get_all_glazing_manufacturers(db: Session) -> list[str]:
    """Get all unique glazing manufacturers from the database."""
    result = (
        db.query(distinct(ApertureGlazingType.manufacturer))
        .filter(
            ApertureGlazingType.manufacturer.isnot(None),
            ApertureGlazingType.manufacturer != "",
        )
        .all()
    )
    return sorted([r[0] for r in result])


def get_used_frame_manufacturers(db: Session, project_id: int) -> list[str]:
    """Get distinct frame manufacturers currently used by aperture elements in a project."""
    result = (
        db.query(distinct(ApertureFrameType.manufacturer))
        .join(
            ApertureElementFrame,
            ApertureElementFrame.frame_type_id == ApertureFrameType.id,
        )
        .join(
            ApertureElement,
            or_(
                ApertureElement.frame_top_id == ApertureElementFrame.id,
                ApertureElement.frame_right_id == ApertureElementFrame.id,
                ApertureElement.frame_bottom_id == ApertureElementFrame.id,
                ApertureElement.frame_left_id == ApertureElementFrame.id,
            ),
        )
        .join(Aperture, Aperture.id == ApertureElement.aperture_id)
        .filter(
            Aperture.project_id == project_id,
            ApertureFrameType.manufacturer.isnot(None),
            ApertureFrameType.manufacturer != "",
        )
        .all()
    )
    return sorted([r[0] for r in result])


def get_used_glazing_manufacturers(db: Session, project_id: int) -> list[str]:
    """Get distinct glazing manufacturers currently used by aperture elements in a project."""
    result = (
        db.query(distinct(ApertureGlazingType.manufacturer))
        .join(
            ApertureElementGlazing,
            ApertureElementGlazing.glazing_type_id == ApertureGlazingType.id,
        )
        .join(ApertureElement, ApertureElement.glazing_id == ApertureElementGlazing.id)
        .join(Aperture, Aperture.id == ApertureElement.aperture_id)
        .filter(
            Aperture.project_id == project_id,
            ApertureGlazingType.manufacturer.isnot(None),
            ApertureGlazingType.manufacturer != "",
        )
        .all()
    )
    return sorted([r[0] for r in result])


def get_project_by_bt_number(db: Session, bt_number: str) -> Project | None:
    """Get project by BT number."""
    return db.query(Project).filter(Project.bt_number == bt_number).first()


def get_enabled_manufacturers(
    db: Session, project_id: int, filter_type: str
) -> list[str]:
    """Get list of enabled manufacturers for a project and filter type."""
    filters = (
        db.query(ProjectManufacturerFilter)
        .filter(
            ProjectManufacturerFilter.project_id == project_id,
            ProjectManufacturerFilter.filter_type == filter_type,
            ProjectManufacturerFilter.is_enabled.is_(True),
        )
        .all()
    )
    return [f.manufacturer for f in filters]


def has_any_filters(db: Session, project_id: int, filter_type: str) -> bool:
    """Check if any filters exist for this project/type (configured vs unconfigured)."""
    count = (
        db.query(ProjectManufacturerFilter)
        .filter(
            ProjectManufacturerFilter.project_id == project_id,
            ProjectManufacturerFilter.filter_type == filter_type,
        )
        .count()
    )
    return count > 0


def update_manufacturer_filters(
    db: Session,
    project_id: int,
    filter_type: str,
    enabled_manufacturers: list[str],
    all_manufacturers: list[str],
) -> None:
    """Update manufacturer filters for a project.

    Creates filter records for all known manufacturers, marking enabled ones.
    """
    db.query(ProjectManufacturerFilter).filter(
        ProjectManufacturerFilter.project_id == project_id,
        ProjectManufacturerFilter.filter_type == filter_type,
    ).delete()

    for manufacturer in all_manufacturers:
        filter_record = ProjectManufacturerFilter(
            project_id=project_id,
            manufacturer=manufacturer,
            filter_type=filter_type,
            is_enabled=manufacturer in enabled_manufacturers,
        )
        db.add(filter_record)

    db.commit()
