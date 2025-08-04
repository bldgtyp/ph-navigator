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
    glazing_element = ApertureElementGlazing(
        glazing_type_id=default_glazing_type.id
    )
    db.add(glazing_element)
    db.commit()
    db.refresh(glazing_element)

    return glazing_element


def create_aperture_element_frame(db: Session) -> ApertureElementFrame:
    """Create a new ApertureElementFrame with the default frame-type."""
    logger.info("create_aperture_element_frame()")

    default_frame_type = get_default_frame_type(db)
    frame_element = ApertureElementFrame(
        frame_type_id=default_frame_type.id
    )
    db.add(frame_element)
    db.commit()
    db.refresh(frame_element)

    return frame_element


def create_aperture_element(
    db: Session, aperture_id: int, name: str = "Unnamed", row_number: int = 1, column_number: int = 1, row_span: int = 1, col_span: int = 1
) -> ApertureElement:
    """Create a new ApertureElement with default glazing and frame types."""
    logger.info(f"create_aperture_element(aperture_id={aperture_id}, name={name}, row_number={row_number}, column_number={column_number})")

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

