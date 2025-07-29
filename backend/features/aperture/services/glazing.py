# -*- Python Version: 3.11 -*-

import logging
from typing import Any

from sqlalchemy.orm import Session

from db_entities.aperture.aperture_element import ApertureElement
from db_entities.aperture.aperture_glazing import ApertureElementGlazing

logger = logging.getLogger(__name__)


class GlazingNotFoundException(Exception):
    """Custom exception for missing Glazing."""

    def __init__(self, glazing_id: str):
        logger.error(f"{self.__class__.__name__}: Glazing {glazing_id} not found.")
        self.glazing_id = glazing_id
        self.message = f"Glazing(s) not found in the database: {glazing_id}"
        super().__init__(self.message)


class DeleteNonExistentGlazingException(Exception):
    """Custom exception for attempting to delete a non-existent Glazing."""

    def __init__(self, glazing_id: str):
        logger.error(f"Attempted to delete non-existent Glazing {glazing_id}.")
        super().__init__(f"Attempted to delete non-existent Glazing {glazing_id}.")


class NoGlazingsException(Exception):
    """Custom exception for when no glazings are found."""

    def __init__(self, glazing_type: str):
        logger.error(f"No glazings found for type: {glazing_type}.")
        super().__init__(f"No glazings found for type: {glazing_type}.")


def get_glazing_by_id(db: Session, glazing_id: str) -> ApertureElementGlazing:
    """Get a Glazing by its ID or raise GlazingNotFoundException."""
    logger.info(f"get_glazing_by_id({glazing_id=})")

    if Glazing := db.query(ApertureElementGlazing).filter_by(id=glazing_id).first():
        return Glazing

    raise GlazingNotFoundException(glazing_id)


def create_new_glazing(
    db: Session,
    id: str,
    name: str,
    u_value_w_m2k: float,
    g_value: float,
    *args: Any,
    **kwargs: Any,
) -> ApertureElementGlazing:
    """Add a new Glazing to the database."""
    logger.info(f"create_new_glazing({name=})")

    new_glazing = ApertureElementGlazing(
        id=id,
        name=name,
        u_value_w_m2k=u_value_w_m2k,
        g_value=g_value,
    )
    db.add(new_glazing)
    db.commit()
    db.refresh(new_glazing)

    return new_glazing


def update_glazing(
    db: Session,
    id: str,
    name: str,
    u_value_w_m2k: float,
    g_value: float,
    *args: Any,
    **kwargs: Any,
) -> ApertureElementGlazing:
    """Update an existing Glazing in the database."""
    logger.info(f"update_glazing({id=})")

    glazing = get_glazing_by_id(db, id)

    glazing.name = name
    glazing.u_value_w_m2k = u_value_w_m2k
    glazing.g_value = g_value

    db.commit()
    db.refresh(glazing)

    return glazing


def add_glazings(db: Session, glazings: list[ApertureElementGlazing]) -> tuple[int, int]:
    """Add (or update) glazings from AirTable to the database."""
    logger.info(f"add_glazings(glazings={len(glazings)}-glazings)")

    num_glazings_added = 0
    num_glazings_updated = 0
    for glazing in glazings:
        try:
            # Try and update an existing Glazing
            update_glazing(db=db, **glazing.__dict__)
            num_glazings_updated += 1
        except GlazingNotFoundException:
            # If the Glazing doesn't exist, create a new one
            create_new_glazing(db=db, **glazing.__dict__)
            num_glazings_added += 1

    db.commit()

    return num_glazings_updated, num_glazings_added


def purge_unused_glazings(db: Session) -> None:
    """Remove any of the existing glazings which are not used by any of the Segments"""
    logger.info("purge_unused_glazings()")

    # Get all existing glazings
    existing_glazings = db.query(ApertureElementGlazing).all()
    existing_glazing_ids = {glazing.id for glazing in existing_glazings}

    # Get all ApertureElement IDs that use this Glazing type
    aperture_element_glazing_ids = {
        aperture_element.glazing_id
        for aperture_element in db.query(ApertureElement).all()
        if aperture_element.glazing_id is not None
    }

    # Find glazings that are not used by any segments
    unused_glazing_ids = existing_glazing_ids - aperture_element_glazing_ids

    # Delete unused glazings
    for glazing_id in unused_glazing_ids:
        try:
            glazing = get_glazing_by_id(db, glazing_id)
            db.delete(glazing)
            logger.info(f"Deleted unused Glazing with ID: {glazing_id}")
        except GlazingNotFoundException:
            raise DeleteNonExistentGlazingException(glazing_id)

    db.commit()
