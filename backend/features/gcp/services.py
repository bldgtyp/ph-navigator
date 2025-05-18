# -*- Python Version: 3.11 (Render.com) -*-

import logging
import io

from PIL import Image
from google.cloud import storage
from fastapi import UploadFile
from sqlalchemy.orm import Session

from config import settings
from db_entities.assembly.segment import Segment
from db_entities.assembly.material_photo import MaterialPhoto


logger = logging.getLogger(__name__)


def check_gcs_bucket_create_file_permissions() -> bool:
    """Check if the account has permission to write to the Google-Cloud-Storage bucket."""

    storage_client = storage.Client()
    bucket = storage_client.bucket(settings.GCP_BUCKET_NAME)
    permissions = ["storage.objects.create"]
    result = bucket.test_iam_permissions(permissions)

    logger.info(f"Permissions result: {result}")

    return "storage.objects.create" in result


def upload_segment_photo(
    db: Session,
    bt_number: int,
    segment_id: int,
    file: UploadFile,
    bucket_name: str,
) -> str:
    segment = db.get(Segment, segment_id)
    if not segment:
        raise ValueError("Segment not found")

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)

    # -- Upload the full-size image to GCS and get the public URL
    blob = bucket.blob(f"{bt_number}/{file.filename}")
    blob.upload_from_file(file.file, content_type=file.content_type)
    blob.make_public()
    full_size_url = blob.public_url
    
    # -- Create the thumbnail, upload it to GCS, and get the public URL
    file.file.seek(0)
    thumb_bytes = create_thumbnail(file)
    thumb_filename = str(file.filename).replace(".", "_thumb.")
    thumb_blob = bucket.blob(f"{bt_number}/{thumb_filename}")
    thumb_blob.upload_from_string(thumb_bytes, content_type="image/png")
    thumb_blob.make_public()
    thumbnail_url = thumb_blob.public_url

    # -- Create the Photo DB entry
    material_photo = MaterialPhoto(
        segment_id=segment.id, full_size_url=full_size_url, thumbnail_url=thumbnail_url
    )
    db.add(material_photo)
    db.commit()
    db.refresh(material_photo)

    return full_size_url


def create_thumbnail(image_file: UploadFile, size=(64, 64)) -> bytes:
    image = Image.open(image_file.file)
    image.thumbnail(size)
    thumb_io = io.BytesIO()
    image.save(thumb_io, format="PNG")
    thumb_io.seek(0)
    return thumb_io.read()