# -*- Python Version: 3.11 -*-

import io
import logging
from pathlib import Path

from fastapi import UploadFile
from google.cloud import storage
from PIL import Image
from sqlalchemy.orm import Session

from config import settings
from db_entities.assembly.material_datasheet import MaterialDatasheet
from db_entities.assembly.material_photo import MaterialPhoto
from db_entities.assembly.segment import Segment

logger = logging.getLogger(__name__)


async def create_thumbnail(image_file: UploadFile, size=(64, 64)) -> bytes:
    """Create a simple thumbnail from an image file."""

    image = Image.open(image_file.file)
    image.thumbnail(size)
    thumb_io = io.BytesIO()
    image.save(thumb_io, format="PNG")
    thumb_io.seek(0)
    return thumb_io.read()


async def sanitize_name(name: str) -> str:
    """Sanitize a name to ensure it is safe for use in URLs.

    Example:
        name = "my_file" -> "my_file"
        name = "my_file@#$%" -> "my_file"
    """

    sanitized_file_name = "".join(c for c in name if c.isalnum() or c in ("_"))
    sanitized_file_name = sanitized_file_name
    return sanitized_file_name


async def sanitize_file_name(filename: str) -> str:
    """Sanitize a file-name (with extension) to ensure it is safe for use in URLs.

    Example:
        filename = "my_file.jpg" -> "my_file.jpg"
        filename = "my_file@#$%.jpg" -> "my_file.jpg"
    """

    file_object = Path(filename)
    sanitized_file_name = await sanitize_name(file_object.stem)
    sanitized_file_name = sanitized_file_name + file_object.suffix
    return sanitized_file_name


def check_gcs_bucket_create_file_permissions() -> bool:
    """Check if the account has permission to write to the Google-Cloud-Storage bucket."""

    storage_client = storage.Client()
    bucket = storage_client.bucket(settings.GCP_BUCKET_NAME)
    permissions = ["storage.objects.create"]
    result = bucket.test_iam_permissions(permissions)

    logger.info(f"Permissions result: {result}")

    return "storage.objects.create" in result


async def upload_segment_site_photo_to_cdn(
    db: Session,
    bt_number: str,
    segment_id: int,
    file: UploadFile,
    bucket_name: str,
) -> tuple[str, str]:
    """Upload a segment site photo (and thumbnail) to Google Cloud Storage and return the public URLs."""

    segment = db.get(Segment, segment_id)
    if not segment:
        raise ValueError("Segment not found")

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)

    # -- Sanitize the file name
    if not file.filename:
        raise ValueError("File name is missing?")
    sanitized_file_name = await sanitize_file_name(file.filename)
    sanitized_material_name = await sanitize_name(segment.material.name)

    # -- Upload the full-size image to GCS and get the public URL
    blob = bucket.blob(f"{bt_number}/site_photos/{sanitized_material_name}_{sanitized_file_name}")
    blob.upload_from_file(file.file, content_type=file.content_type)
    blob.make_public()
    full_size_url = blob.public_url

    # -- Create the thumbnail, upload it to GCS, and get the public URL
    file.file.seek(0)
    thumb_bytes = await create_thumbnail(file)
    thumb_blob = bucket.blob(f"{bt_number}/site_photos/thumbnails/{sanitized_material_name}_{sanitized_file_name}")
    thumb_blob.upload_from_string(thumb_bytes, content_type="image/png")
    thumb_blob.make_public()
    thumbnail_url = thumb_blob.public_url

    return thumbnail_url, full_size_url


async def add_site_photo_to_segment(
    db: Session,
    segment_id: int,
    thumbnail_url: str,
    full_size_url: str,
) -> MaterialPhoto:
    """Add a site photo's URLS (thumbnail, full-size) to a segment in the database."""

    segment = db.get(Segment, segment_id)
    if not segment:
        raise ValueError("Segment not found")

    # -- Create the Photo DB entry
    material_photo = MaterialPhoto(segment_id=segment.id, full_size_url=full_size_url, thumbnail_url=thumbnail_url)
    db.add(material_photo)
    db.commit()
    db.refresh(material_photo)

    return material_photo


async def upload_segment_datasheet_to_cdn(
    db: Session,
    bt_number: str,
    segment_id: int,
    file: UploadFile,
    bucket_name: str,
) -> tuple[str, str]:
    """Upload a segment datasheet (and thumbnail) to Google Cloud Storage and return the public URLs."""

    segment = db.get(Segment, segment_id)
    if not segment:
        raise ValueError("Segment not found")

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)

    # -- Sanitize the file name
    if not file.filename:
        raise ValueError("File name is missing?")
    sanitized_file_name = await sanitize_file_name(file.filename)
    sanitized_material_name = await sanitize_name(segment.material.name)

    # -- Upload the full-size image to GCS and get the public URL
    blob = bucket.blob(f"{bt_number}/datasheets/{sanitized_material_name}_{sanitized_file_name}")
    blob.upload_from_file(file.file, content_type=file.content_type)
    blob.make_public()
    full_size_url = blob.public_url

    # -- Create the thumbnail, upload it to GCS, and get the public URL
    file.file.seek(0)
    thumb_bytes = await create_thumbnail(file)
    thumb_blob = bucket.blob(f"{bt_number}/datasheets/thumbnails/{sanitized_material_name}_{sanitized_file_name}")
    thumb_blob.upload_from_string(thumb_bytes, content_type="image/png")
    thumb_blob.make_public()
    thumbnail_url = thumb_blob.public_url

    return thumbnail_url, full_size_url


async def add_datasheet_to_segment(
    db: Session,
    segment_id: int,
    thumbnail_url: str,
    full_size_url: str,
) -> MaterialDatasheet:
    """Add a site photo's URLS (thumbnail, full-size) to a segment in the database."""

    segment = db.get(Segment, segment_id)
    if not segment:
        raise ValueError("Segment not found")

    # -- Create the Photo DB entry
    material_datasheet = MaterialDatasheet(
        segment_id=segment.id, full_size_url=full_size_url, thumbnail_url=thumbnail_url
    )
    db.add(material_datasheet)
    db.commit()
    db.refresh(material_datasheet)

    return material_datasheet
