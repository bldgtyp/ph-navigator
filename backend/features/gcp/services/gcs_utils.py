# -*- Python Version: 3.11 -*-

import asyncio
import logging
from pathlib import Path
from urllib.parse import urlparse

from google.cloud import storage
from sqlalchemy.orm import Session

from features.assembly.services.segment import get_segment_by_id
from features.gcp.services.file_utils import FileContent, sanitize_file_name_stem
from features.gcp.services.image_utils import generate_image_thumbnail, generate_pdf_thumbnail, resize_image

logger = logging.getLogger(__name__)


class FileDeleteFailedException(Exception):
    """Custom exception for file deletion failures."""

    def __init__(self, file_url: str):
        self.message = f"File at {file_url=} could not be deleted from storage."
        super().__init__(self.message)
        logger.error(self.message)


def parse_gcs_url(url: str) -> tuple[str, str]:
    """Parse a Google Cloud Storage URL and return the bucket name and object name."""
    logger.info(f"parse_gcs_url({url=})")

    parsed = urlparse(url)

    if parsed.netloc == "storage.googleapis.com":
        # Format: https://storage.googleapis.com/[BUCKET]/[OBJECT]
        path_parts = parsed.path.lstrip("/").split("/", 1)
        if len(path_parts) != 2:
            raise ValueError("URL does not contain both bucket and object name.")
        bucket_name, object_name = path_parts
    elif parsed.netloc.endswith(".storage.googleapis.com"):
        # Format: https://[BUCKET].storage.googleapis.com/[OBJECT]
        bucket_name = parsed.netloc.split(".storage.googleapis.com")[0]
        object_name = parsed.path.lstrip("/")
    else:
        raise ValueError("Unsupported GCS URL format.")

    return bucket_name, object_name


def create_image_upload_paths(
    db: Session, bt_number: str, segment_id: int, folder_name: str, content_hash: str, file_name: str
) -> tuple[str, str]:
    """Generate the full-size and thumbnail paths for an image upload."""
    logger.info(f"get_image_upload_paths({bt_number=}, {segment_id=}, {folder_name=}, {content_hash=}, {file_name=})")

    segment = get_segment_by_id(db, segment_id)

    # -- Create file paths with content hash
    file_ext = Path(file_name).suffix
    sanitized_material_name = sanitize_file_name_stem(segment.material.name)

    # Use the content hash in the filename
    full_size_path = f"{bt_number}/{folder_name}/{sanitized_material_name}_{content_hash}{file_ext}"
    thumb_path = f"{bt_number}/{folder_name}/thumbnails/{sanitized_material_name}_{content_hash}{file_ext}"

    return full_size_path, thumb_path


def check_gcs_blobs_existence(bucket_name: str, full_size_path: str, thumb_path: str) -> dict:
    """Check if blobs already exist in Google Cloud Storage.

    Note: do not run this function in parallel, it will cause timeout errors when run in deployment.
    """
    logger.info(f"check_gcs_blobs_existence({bucket_name=}, {full_size_path=}, {thumb_path=})")

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)

    full_size_blob = bucket.blob(full_size_path)
    thumb_blob = bucket.blob(thumb_path)

    full_exists = full_size_blob.exists()
    thumb_exists = thumb_blob.exists()

    return {
        "full_exists": full_exists,
        "thumb_exists": thumb_exists,
        "full_url": f"https://storage.googleapis.com/{bucket_name}/{full_size_path}" if full_exists else None,
        "thumb_url": f"https://storage.googleapis.com/{bucket_name}/{thumb_path}" if thumb_exists else None,
    }


async def upload_thumbnail_image(image_bytes: bytes, bucket_name: str, thumb_path: str, blob_status: dict) -> str:
    """Create and upload thumbnail if needed."""
    logger.info(f"upload_thumbnail_image({len(image_bytes)=}, {bucket_name=}, {thumb_path=})")

    if blob_status["thumb_exists"]:
        return blob_status["thumb_url"]

    loop = asyncio.get_running_loop()

    def do_upload():
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        thumb_blob = bucket.blob(thumb_path)
        thumb_blob.upload_from_string(image_bytes, content_type="image/png")
        thumb_blob.make_public()
        return thumb_blob.public_url

    return await loop.run_in_executor(None, do_upload)


async def upload_full_size_file(
    content: bytes, content_type: str, bucket_name: str, full_size_path: str, blob_status: dict
) -> str:
    """Upload full-size file after resizing to reasonable dimensions if needed."""
    logger.info(f"upload_full_size_image({bucket_name=}, {full_size_path=})")

    if blob_status["full_exists"]:
        return blob_status["full_url"]

    loop = asyncio.get_running_loop()

    def upload_to_gcs():
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(full_size_path)
        blob.upload_from_string(content, content_type=content_type)
        blob.make_public()
        return blob.public_url

    return await loop.run_in_executor(None, upload_to_gcs)


async def upload_file_to_gcs(
    db: Session,
    bt_number: str,
    segment_id: int,
    file: FileContent,
    bucket_name: str,
    folder_name: str,
) -> tuple[str, str]:
    """Upload an Image-file to Google-Cloud-Storage and return the public URLs."""
    logger.info(f"upload_file_to_gcs({bt_number=}, {segment_id=}, {file.filename=}, {bucket_name=}, {folder_name=})")

    # Prepare file content and paths
    file_path, thumbnail_path = create_image_upload_paths(
        db, bt_number, segment_id, folder_name, file.content_hash, file.filename
    )

    # ------------------------------------------------------------------------------------------------------------------
    # Check if files already exist
    blob_status = check_gcs_blobs_existence(bucket_name, file_path, thumbnail_path)

    # ------------------------------------------------------------------------------------------------------------------
    # -- Prepare the upload file-content
    try:
        if file.content_type == "application/pdf":
            thumbnail_image_bytes = generate_pdf_thumbnail(file.content)
            file_data_bytes = file.content
        elif file.content_type in ["image/png", "image/jpeg", "image/jpg"]:
            thumbnail_image_bytes = generate_image_thumbnail(file.content)
            file_data_bytes = resize_image(file.content, file.content_type)
        else:
            raise ValueError(f"Unsupported content type: {file.content_type}")
    except Exception as e:
        raise ValueError(f"Failed to generate thumbnail: {e}")

    # ------------------------------------------------------------------------------------------------------------------
    # -- Upload file-content
    try:
        thumbnail_url = await upload_thumbnail_image(thumbnail_image_bytes, bucket_name, thumbnail_path, blob_status)
        logger.info(f"Thumbnail image uploaded successfully: {thumbnail_url}")

        full_size_url = await upload_full_size_file(
            file_data_bytes, file.content_type, bucket_name, file_path, blob_status
        )
        logger.info(f"Full-size file uploaded successfully: {full_size_url}")
    except Exception as e:
        raise Exception(f"Failed to upload file to GCS: {e}")

    return thumbnail_url, full_size_url


async def delete_file_from_gcs(file_url: str) -> bool:
    """Delete a file from Google-Cloud-Storage given its public URL.

    Args:
        file_url: The public URL of the file to delete.

    Returns:
        bool: True if deletion was successful, False otherwise
    """
    logger.info(f"delete_file_from_storage({file_url=})")

    try:
        # Parse the URL to get bucket name and object name
        bucket_name, object_name = parse_gcs_url(file_url)

        # Run the blocking GCS operations in a thread pool
        loop = asyncio.get_running_loop()

        # Define the function to run in the thread pool
        def delete_blob():
            storage_client = storage.Client()
            bucket = storage_client.bucket(bucket_name)
            blob = bucket.blob(object_name)

            # Check if the blob exists before attempting to delete
            if not blob.exists():
                logger.warning(f"File at {file_url} does not exist in storage")
                return False

            # Delete the blob if it exists
            blob.delete()
            return True

        # Execute the blocking operation in a thread pool
        result = await loop.run_in_executor(None, delete_blob)

        if result:
            logger.info(f"Successfully deleted file at: {file_url}")
        return result
    except Exception as e:
        logger.error(f"Failed to delete file from storage: {e}")
        return False
