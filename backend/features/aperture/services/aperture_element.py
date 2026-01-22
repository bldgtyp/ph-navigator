# -*- Python Version: 3.11 -*-

import logging

from sqlalchemy.orm import Session

from db_entities.aperture import ApertureElement, ApertureElementFrame, ApertureElementGlazing
from features.aperture.services.frame_type import get_default_frame_type
from features.aperture.services.glazing_type import get_default_glazing_type

logger = logging.getLogger(__name__)


def get_aperture_element_by_id(db: Session, aperture_id: int) -> ApertureElement:
    """Retrieve an ApertureElement by its DB-ID Number."""
    logger.info(f"get_aperture_element_by_id({aperture_id})")

    aperture = db.query(ApertureElement).filter(ApertureElement.id == aperture_id).first()
    if not aperture:
        raise ValueError(f"ApertureElement with ID {aperture_id} not found.")

    return aperture


def create_aperture_element_glazing(db: Session) -> ApertureElementGlazing:
    """Create a new ApertureElementGlazing with the default glazing-type."""
    logger.info("create_aperture_element_glazing()")

    default_glazing_type = get_default_glazing_type(db)
    glazing_element = ApertureElementGlazing(glazing_type_id=default_glazing_type.id)
    db.add(glazing_element)
    db.commit()
    db.refresh(glazing_element)

    return glazing_element


def create_aperture_element_frame(db: Session) -> ApertureElementFrame:
    """Create a new ApertureElementFrame with the default frame-type."""
    logger.info("create_aperture_element_frame()")

    default_frame_type = get_default_frame_type(db)
    frame_element = ApertureElementFrame(frame_type_id=default_frame_type.id)
    db.add(frame_element)
    db.commit()
    db.refresh(frame_element)

    return frame_element


def duplicate_aperture_element_frame(db: Session, source_frame: ApertureElementFrame) -> ApertureElementFrame:
    """Create a duplicate of an ApertureElementFrame.

    Args:
        db: Database session
        source_frame: The frame to duplicate

    Returns:
        New ApertureElementFrame instance (added to session but not committed)
    """
    logger.info(f"duplicate_aperture_element_frame(source_frame_id={source_frame.id})")

    new_frame = ApertureElementFrame(name=source_frame.name, frame_type_id=source_frame.frame_type_id)
    db.add(new_frame)
    db.flush()  # Get ID without committing

    return new_frame


def duplicate_aperture_element_glazing(db: Session, source_glazing: ApertureElementGlazing) -> ApertureElementGlazing:
    """Create a duplicate of an ApertureElementGlazing.

    Args:
        db: Database session
        source_glazing: The glazing to duplicate

    Returns:
        New ApertureElementGlazing instance (added to session but not committed)
    """
    logger.info(f"duplicate_aperture_element_glazing(source_glazing_id={source_glazing.id})")

    new_glazing = ApertureElementGlazing(name=source_glazing.name, glazing_type_id=source_glazing.glazing_type_id)
    db.add(new_glazing)
    db.flush()  # Get ID without committing

    return new_glazing


def duplicate_aperture_element(db: Session, source_element: ApertureElement, new_aperture_id: int) -> ApertureElement:
    """Create a duplicate of an ApertureElement with all its frames and glazing.

    Args:
        db: Database session
        source_element: The element to duplicate
        new_aperture_id: ID of the new parent aperture

    Returns:
        New ApertureElement instance (added to session but not committed)
    """
    logger.info(f"duplicate_aperture_element(source_element_id={source_element.id}, new_aperture_id={new_aperture_id})")

    # Duplicate all 4 frames
    new_frame_top = duplicate_aperture_element_frame(db, source_element.frame_top)
    new_frame_right = duplicate_aperture_element_frame(db, source_element.frame_right)
    new_frame_bottom = duplicate_aperture_element_frame(db, source_element.frame_bottom)
    new_frame_left = duplicate_aperture_element_frame(db, source_element.frame_left)

    # Duplicate glazing
    new_glazing = duplicate_aperture_element_glazing(db, source_element.glazing)

    # Create new element with duplicated components
    new_element = ApertureElement(
        name=source_element.name,
        row_number=source_element.row_number,
        column_number=source_element.column_number,
        row_span=source_element.row_span,
        col_span=source_element.col_span,
        operation=source_element.operation,
        aperture_id=new_aperture_id,
        glazing=new_glazing,
        frame_top=new_frame_top,
        frame_right=new_frame_right,
        frame_bottom=new_frame_bottom,
        frame_left=new_frame_left,
    )

    db.add(new_element)
    db.flush()  # Get ID without committing

    return new_element


def create_aperture_element(
    db: Session,
    aperture_id: int,
    name: str = "Unnamed",
    row_number: int = 1,
    column_number: int = 1,
    row_span: int = 1,
    col_span: int = 1,
) -> ApertureElement:
    """Create a new ApertureElement with default glazing and frame types."""
    logger.info(
        f"create_aperture_element(aperture_id={aperture_id}, name={name}, row_number={row_number}, column_number={column_number})"
    )

    try:
        new_element = ApertureElement(
            name=name,
            row_number=row_number,
            column_number=column_number,
            row_span=row_span,
            col_span=col_span,
            aperture_id=aperture_id,
            glazing=create_aperture_element_glazing(db),
            frame_top=create_aperture_element_frame(db),
            frame_right=create_aperture_element_frame(db),
            frame_bottom=create_aperture_element_frame(db),
            frame_left=create_aperture_element_frame(db),
        )

        db.add(new_element)
        db.commit()
        db.refresh(new_element)

        return new_element

    except Exception as e:
        db.rollback()
        logger.error(f"Error creating aperture element: {str(e)}")
        raise
