# -*- Python Version: 3.11 -*-

import logging

from sqlalchemy.orm import Session

from db_entities.assembly.material_datasheet import MaterialDatasheet
from features.assembly.services.segment import get_segment_by_id
from features.gcp.services.gcs_utils import FileDeleteFailedException, delete_file_from_gcs

logger = logging.getLogger(__name__)


class DatasheetNotFoundException(Exception):
    """Custom exception for missing datasheet."""

    def __init__(self, datasheet_id: int):
        self.message = f"Datasheet with ID {datasheet_id} not found."
        logger.error(self.message)
        super().__init__(self.message)


def material_datasheet_file_exists(db: Session, segment_id, content_hash) -> bool:
    """Check if this content hash already exists in db for this segment."""
    logger.info(f"material_datasheet_file_exists({segment_id=}, {content_hash=})")

    existing = (
        db.query(MaterialDatasheet)
        .filter(
            MaterialDatasheet.segment_id == segment_id,
            MaterialDatasheet.content_hash == content_hash,  # You'd need to add this column
        )
        .first()
    )

    if existing:
        logger.info(f"File with identical content already exists (id: {existing.id})")
        return True
    return False


def get_segment_datasheets(db: Session, segment_id: int) -> list[MaterialDatasheet]:
    """Get all of the datasheets associated with a Segment."""
    logger.info(f"get_segment_datasheets({segment_id=})")

    segment = get_segment_by_id(db, segment_id)
    return db.query(MaterialDatasheet).filter(MaterialDatasheet.segment_id == segment.id).all()


def get_datasheet_by_id(db: Session, datasheet_id: int) -> MaterialDatasheet:
    """Get a datasheet by its ID from the database."""
    logger.info(f"get_datasheet_by_id({datasheet_id=})")

    datasheet = db.query(MaterialDatasheet).filter(MaterialDatasheet.id == datasheet_id).first()
    if not datasheet:
        raise DatasheetNotFoundException(datasheet_id)
    return datasheet


def add_datasheet_to_segment(
    db: Session,
    segment_id: int,
    thumbnail_url: str,
    full_size_url: str,
    content_hash: str,
) -> MaterialDatasheet:
    """Add a site photo's URLS (thumbnail, full-size) to a segment in the database.

    Args:
        db: Database session
        segment_id: The ID of the segment to which the datasheet belongs
        thumbnail_url: The public URL of the thumbnail image
        full_size_url: The public URL of the full-size image
        content_hash: The MD5 hash of the file content for deduplication
    Returns:
        MaterialDatasheet: The created MaterialDatasheet object with the segment's datasheet URLs
    """
    logger.info(f"add_datasheet_to_segment({segment_id=}, {thumbnail_url=}, {full_size_url=})")

    segment = get_segment_by_id(db, segment_id)

    # -- Create the Photo DB entry
    material_datasheet = MaterialDatasheet(
        segment_id=segment.id,
        full_size_url=full_size_url,
        thumbnail_url=thumbnail_url,
        content_hash=content_hash,
    )
    db.add(material_datasheet)
    db.commit()
    db.refresh(material_datasheet)

    return material_datasheet


async def delete_datasheet(db: Session, datasheet: MaterialDatasheet) -> None:
    """Delete a datasheet from the database and storage.

    Args:
        db: Database session
        datasheet: The MaterialDatasheet object to delete
    """
    logger.info(f"delete_datasheet({datasheet.id=})")

    # -- Delete the Thumbnail file from storage
    deleted = await delete_file_from_gcs(file_url=datasheet.thumbnail_url)
    if not deleted:
        raise FileDeleteFailedException(datasheet.thumbnail_url)

    # -- Delete the Full-Size file from storage
    deleted = await delete_file_from_gcs(file_url=datasheet.full_size_url)
    if not deleted:
        raise FileDeleteFailedException(datasheet.full_size_url)

    # -- Delete from database
    db.delete(datasheet)
    db.commit()
