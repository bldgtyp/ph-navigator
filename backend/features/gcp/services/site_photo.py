# -*- Python Version: 3.11 -*-

import logging

from sqlalchemy.orm import Session

from db_entities.assembly.material_photo import MaterialPhoto
from features.assembly.services.segment import get_segment_by_id
from features.gcp.services.gcs_utils import delete_file_from_gcs, FileDeleteFailedException

logger = logging.getLogger(__name__)


class SitePhotoNotFoundException(Exception):
    """Custom exception for missing site photo."""

    def __init__(self, photo_id: int):
        self.message = f"Site photo with ID {photo_id} not found."
        logger.error(self.message)
        super().__init__(self.message)


def material_site_photo_file_exists(db: Session, segment_id, content_hash) -> bool:
    """Check if this content hash already exists in db for this segment."""
    logger.info(f"material_photo_file_exists({segment_id=}, {content_hash=})")

    existing = (
        db.query(MaterialPhoto)
        .filter(
            MaterialPhoto.segment_id == segment_id,
            MaterialPhoto.content_hash == content_hash,  # You'd need to add this column
        )
        .first()
    )

    if existing:
        logger.info(f"File with identical content already exists (id: {existing.id})")
        return True
    return False


def get_segment_site_photos(db: Session, segment_id: int) -> list[MaterialPhoto]:
    """Get all of the site-photos associated with a Segment."""
    logger.info(f"get_segment_site_photos({segment_id=})")

    segment = get_segment_by_id(db, segment_id)
    return db.query(MaterialPhoto).filter(MaterialPhoto.segment_id == segment.id).all()


def get_site_photo_by_id(db: Session, site_photo_id: int) -> MaterialPhoto:
    """Get a site-photo by its ID from the database."""
    logger.info(f"get_site_photo_by_id({site_photo_id=})")

    photo = db.query(MaterialPhoto).filter(MaterialPhoto.id == site_photo_id).first()
    if not photo:
        raise SitePhotoNotFoundException(site_photo_id)
    return photo


def add_site_photo_to_segment(
    db: Session,
    segment_id: int,
    thumbnail_url: str,
    full_size_url: str,
    content_hash: str,
) -> MaterialPhoto:
    """Add a site photo's URLS (thumbnail, full-size) to a segment in the database.

    Args:
        db: Database session
        segment_id: The ID of the segment to which the photo belongs
        thumbnail_url: The public URL of the thumbnail image
        full_size_url: The public URL of the full-size image
        content_hash: The MD5 hash of the file content for deduplication
    Returns:
        MaterialPhoto: The created MaterialPhoto object with the segment's photo URLs
    """
    logger.info(f"add_site_photo_to_segment({segment_id=}, {thumbnail_url=}, {full_size_url=})")

    segment = get_segment_by_id(db, segment_id)

    # -- Create the Photo DB entry
    material_photo = MaterialPhoto(
        segment_id=segment.id,
        full_size_url=full_size_url,
        thumbnail_url=thumbnail_url,
        content_hash=content_hash,
    )
    db.add(material_photo)
    db.commit()
    db.refresh(material_photo)

    return material_photo


async def delete_site_photo(db: Session, photo: MaterialPhoto) -> None:
    """Delete a site-photo from the database and storage.

    Args:
        db: Database session
        photo: The MaterialPhoto object to delete
    """
    logger.info(f"delete_site_photo({photo.id=})")

    # -- Delete the Thumbnail file from storage
    deleted = await delete_file_from_gcs(file_url=photo.thumbnail_url)
    if not deleted:
        raise FileDeleteFailedException(photo.thumbnail_url)

    # -- Delete the Full-Size file from storage
    deleted = await delete_file_from_gcs(file_url=photo.full_size_url)
    if not deleted:
        raise FileDeleteFailedException(photo.full_size_url)

    # -- Delete from database
    db.delete(photo)
    db.commit()

