# -*- Python Version: 3.11 -*-

import logging
from typing import Any

from sqlalchemy.orm import Session

from db_entities.aperture.aperture_element import ApertureElement
from db_entities.aperture.aperture_frame import ApertureElementFrame

logger = logging.getLogger(__name__)


class FrameNotFoundException(Exception):
    """Custom exception for missing Frame."""

    def __init__(self, material_id: str):
        logger.error(f"{self.__class__.__name__}: Frame {material_id} not found.")
        self.material_id = material_id
        self.message = f"Frame(s) not found in the database: {material_id}"
        super().__init__(self.message)


class DeleteNonExistentFrameException(Exception):
    """Custom exception for attempting to delete a non-existent Frame."""

    def __init__(self, material_id: str):
        logger.error(f"Attempted to delete non-existent Frame {material_id}.")
        super().__init__(f"Attempted to delete non-existent Frame {material_id}.")


class NoMaterialsException(Exception):
    """Custom exception for when no materials are found."""

    def __init__(self, material_type: str):
        logger.error(f"No materials found for type: {material_type}.")
        super().__init__(f"No materials found for type: {material_type}.")


def get_frame_by_id(db: Session, frame_id: str) -> ApertureElementFrame:
    """Get a frame by its ID or raise FrameNotFoundException."""
    logger.info(f"get_frame_by_id({frame_id=})")

    if frame := db.query(ApertureElementFrame).filter_by(id=frame_id).first():
        return frame

    raise FrameNotFoundException(frame_id)


def create_new_frame(
    db: Session,
    id: str,
    name: str,
    width_mm: float,
    u_value_w_m2k: float,
    *args: Any,
    **kwargs: Any,
) -> ApertureElementFrame:
    """Add a new frame to the database."""
    logger.info(f"Adding new frame with name: {name}")

    new_material = ApertureElementFrame(
        id=id,
        name=name,
        width_mm=width_mm,
        u_value_w_m2k=u_value_w_m2k,
    )
    db.add(new_material)
    db.commit()
    db.refresh(new_material)

    return new_material


def update_frame(
    db: Session,
    id: str,
    name: str,
    width_mm: float,
    u_value_w_m2k: float,
    *args: Any,
    **kwargs: Any,
) -> ApertureElementFrame:
    """Update an existing frame in the database."""
    logger.info(f"Updating frame with ID: {id}")

    frame = get_frame_by_id(db, id)

    frame.name = name
    frame.width_mm = width_mm
    frame.u_value_w_m2k = u_value_w_m2k

    db.commit()
    db.refresh(frame)

    return frame


def add_frames(db: Session, frames: list[ApertureElementFrame]) -> tuple[int, int]:
    """Add (or update) frames from AirTable to the database."""
    logger.info(f"add_frames(db, frames={len(frames)}-frames)")

    num_frames_added = 0
    num_frames_updated = 0
    for frame in frames:
        try:
            # Try and update an existing frame
            update_frame(db=db, **frame.__dict__)
            num_frames_updated += 1
        except FrameNotFoundException:
            # If the frame doesn't exist, create a new one
            create_new_frame(db=db, **frame.__dict__)
            num_frames_added += 1

    db.commit()

    return num_frames_updated, num_frames_added


def purge_unused_frames(db: Session) -> None:
    """Remove any of the existing frames which are not used by any of the Segments"""
    logger.info("purge_unused_frames(db)")

    # Get all existing frames
    existing_frames = db.query(ApertureElementFrame).all()
    existing_frame_ids = {frame.id for frame in existing_frames}

    # Get all ApertureElement IDs that use this frame type
    aperture_element_frame_ids = {
        frame_id for aperture_element in db.query(ApertureElement).all()
        for frame_id in aperture_element.frame_ids
        if frame_id is not None
    }

    # Find frames that are not used by any segments
    unused_frame_ids = existing_frame_ids - aperture_element_frame_ids

    # Delete unused frames
    for frame_id in unused_frame_ids:
        try:
            frame = get_frame_by_id(db, frame_id)
            db.delete(frame)
            logger.info(f"Deleted unused frame with ID: {frame_id}")
        except FrameNotFoundException:
            raise DeleteNonExistentFrameException(frame_id)

    db.commit()
