# -*- Python Version: 3.11 -*-

import logging
from typing import Any

from sqlalchemy.orm import Session

from db_entities.aperture.aperture_element import ApertureElement
from db_entities.aperture.frame_type import ApertureFrameType

logger = logging.getLogger(__name__)


class FrameTypeNotFoundException(Exception):
    """Custom exception for missing Frame-Type."""

    def __init__(self, frame_id: str):
        logger.error(f"{self.__class__.__name__}: Frame type {frame_id} not found.")
        self.frame_id = frame_id
        self.message = f"Frame Type(s) not found in the database: {frame_id}"
        super().__init__(self.message)


class DeleteNonExistentFrameTypeException(Exception):
    """Custom exception for attempting to delete a non-existent Frame-Type."""

    def __init__(self, frame_id: str):
        logger.error(f"Attempted to delete non-existent Frame {frame_id}.")
        super().__init__(f"Attempted to delete non-existent Frame {frame_id}.")


class NoFrameTypesException(Exception):
    """Custom exception for when no frame types are found."""

    def __init__(self, frame_type: str):
        logger.error(f"No frame types found for type: {frame_type}.")
        super().__init__(f"No frame types found for type: {frame_type}.")


def get_frame_type_by_id(db: Session, frame_id: str) -> ApertureFrameType:
    """Get a frame-type by its ID or raise FrameTypeNotFoundException."""
    logger.info(f"get_frame_by_id({frame_id=})")

    if frame := db.query(ApertureFrameType).filter_by(id=frame_id).first():
        return frame

    raise FrameTypeNotFoundException(frame_id)


def get_default_frame_type(db: Session) -> ApertureFrameType:
    """Get the default frame type from the database."""
    logger.info("get_default_frame_type()")

    # Search for the name=Default
    default_frame = db.query(ApertureFrameType).filter_by(name="Default").first()
    if default_frame:
        return default_frame

    # If not found, return the first frame type
    first_frame = db.query(ApertureFrameType).first()
    if first_frame:
        return first_frame

    raise NoFrameTypesException("Default Frame Type")


def create_new_frame_type(
    db: Session,
    id: str,
    name: str,
    width_mm: float,
    u_value_w_m2k: float,
    *args: Any,
    **kwargs: Any,
) -> ApertureFrameType:
    """Add a new frame-type to the database."""
    logger.info(f"Adding new frame-type with name: {name}")

    new_frame = ApertureFrameType(
        id=id,
        name=name,
        width_mm=width_mm,
        u_value_w_m2k=u_value_w_m2k,
    )
    db.add(new_frame)
    db.commit()
    db.refresh(new_frame)

    return new_frame


def update_frame_type(
    db: Session,
    id: str,
    name: str,
    width_mm: float,
    u_value_w_m2k: float,
    *args: Any,
    **kwargs: Any,
) -> ApertureFrameType:
    """Update an existing frame-type in the database."""
    logger.info(f"update_frame_type({id=}, {name=}, {width_mm=}, {u_value_w_m2k=})")

    frame = get_frame_type_by_id(db, id)

    frame.name = name
    frame.width_mm = width_mm
    frame.u_value_w_m2k = u_value_w_m2k

    db.commit()
    db.refresh(frame)

    return frame


def add_frame_types(db: Session, frame_types: list[ApertureFrameType]) -> tuple[int, int]:
    """Add (or update) frame-types from AirTable to the database."""
    logger.info(f"add_frame_types(db, frame_types={len(frame_types)})")

    num_frame_types_added = 0
    num_frame_types_updated = 0
    for frame in frame_types:
        try:
            # Try and update an existing frame
            update_frame_type(db=db, **frame.__dict__)
            num_frame_types_updated += 1
        except FrameTypeNotFoundException:
            # If the frame doesn't exist, create a new one
            create_new_frame_type(db=db, **frame.__dict__)
            num_frame_types_added += 1

    db.commit()

    return num_frame_types_updated, num_frame_types_added


def purge_unused_frame_types(db: Session) -> None:
    """Remove any of the existing frame-types which are not used by any of the Segments"""
    logger.info("purge_unused_frame_types(db)")

    # Get all existing frame-types
    existing_frame_types = db.query(ApertureFrameType).all()
    existing_frame_type_ids = {frame.id for frame in existing_frame_types}

    # Get all ApertureElement IDs that use this frame type
    aperture_element_frame_ids = {
        frame.frame_type_id
        for aperture_element in db.query(ApertureElement).all()
        for frame in aperture_element.frames.values()
    }

    # Find frame-types that are not used by any segments
    unused_frame_type_ids = existing_frame_type_ids - aperture_element_frame_ids

    # Delete unused frame-types
    for frame_type_id in unused_frame_type_ids:
        try:
            frame = get_frame_type_by_id(db, frame_type_id)
            db.delete(frame)
            logger.info(f"Deleted unused frame with ID: {frame_type_id}")
        except FrameTypeNotFoundException:
            raise DeleteNonExistentFrameTypeException(frame_type_id)

    db.commit()
