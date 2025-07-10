# -*- Python Version: 3.11 -*-

import logging

from sqlalchemy.orm import Session

from db_entities.aperture import ApertureElement

logger = logging.getLogger(__name__)


def get_aperture_element_by_id(db: Session, aperture_id: int) -> ApertureElement:
    """Retrieve an ApertureElement by its DB-ID Number."""
    logger.info(f"get_aperture_element_by_id({aperture_id})")

    aperture = db.query(ApertureElement).filter(ApertureElement.id == aperture_id).first()
    if not aperture:
        raise ValueError(f"ApertureElement with ID {aperture_id} not found.")

    return aperture
