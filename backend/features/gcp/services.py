# -*- Python Version: 3.11 -*-

import asyncio
import hashlib
import io
import logging
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse

from fastapi import UploadFile
from google.cloud import storage
from PIL import Image
from PIL.Image import Resampling
from sqlalchemy.orm import Session

from db_entities.assembly.material_datasheet import MaterialDatasheet
from db_entities.assembly.material_photo import MaterialPhoto
from features.assembly.services.segment import get_segment_by_id

logger = logging.getLogger(__name__)


class SitePhotoNotFoundException(Exception):
    """Custom exception for missing site photo."""

    def __init__(self, photo_id: int):
        self.message = f"Site photo with ID {photo_id} not found."
        logger.error(self.message)
        super().__init__(self.message)


class FileDeleteFailedException(Exception):
    """Custom exception for file deletion failures."""

    def __init__(self, file_url: str):
        self.message = f"File at {file_url=} could not be deleted from storage."
        super().__init__(self.message)
        logger.error(self.message)


class DatasheetNotFoundException(Exception):
    """Custom exception for missing datasheet."""

    def __init__(self, datasheet_id: int):
        self.message = f"Datasheet with ID {datasheet_id} not found."
        logger.error(self.message)
        super().__init__(self.message)


class FileExistsInDBException(Exception):
    """Custom exception for file already existing in the database."""

    def __init__(self):
        self.message = "File with identical content already exists in the database."
        logger.error(self.message)
        super().__init__(self.message)


# ---------------------------------------------------------------------------------------
# -- Google Cloud Storage Utilities


def validate_upload_file_type(file: UploadFile, valid_extensions: list[str]) -> bool:
    """Validate that the file is a supported image format (PNG or JPEG).

    Args:
        file: The uploaded file to validate

    Returns:
        bool: True if the file is a valid image type, False otherwise
    """
    logger.info(f"validate_image_file_type({file.filename=})")

    # Check file extension
    if not file.filename:
        return False

    filename_lower = file.filename.lower()
    has_valid_extension = any(filename_lower.endswith(ext) for ext in valid_extensions)

    # Check content type
    content_type = file.content_type or ""
    valid_content_types = ["image/jpeg", "image/jpg", "image/png"]
    has_valid_content_type = content_type.lower() in valid_content_types

    return has_valid_extension and has_valid_content_type


async def calculate_file_hash(file: UploadFile) -> str:
    """Calculate MD5 hash of a file without loading it entirely into memory."""
    logger.info(f"calculate_file_hash({file.filename=})")

    md5 = hashlib.md5()
    chunk_size = 8192  # 8KB chunks

    # Reset file position to start
    await file.seek(0)

    # Process in chunks
    while chunk := await file.read(chunk_size):
        md5.update(chunk)

    # Reset file position for subsequent use
    await file.seek(0)

    return md5.hexdigest()


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


def sanitize_file_name_stem(name: str) -> str:
    """Sanitize a name to ensure it is safe for use in URLs.

    Example:
        name = "my_file" -> "my_file"
        name = "my_file@#$%" -> "my_file"
    """
    logger.info(f"sanitize_file_name_stem({name})")

    sanitized_file_name = "".join(c for c in name if c.isalnum() or c in ("_"))
    sanitized_file_name = sanitized_file_name
    return sanitized_file_name


def sanitize_file_name_with_suffix(filename: str) -> str:
    """Sanitize a file-name (with extension) to ensure it is safe for use in URLs.

    Example:
        filename = "my_file.jpg" -> "my_file.jpg"
        filename = "my_file@#$%.jpg" -> "my_file.jpg"
    """
    logger.info(f"sanitize_file_name_with_suffix({filename})")

    file_object = Path(filename)
    sanitized_file_name = sanitize_file_name_stem(file_object.stem)
    sanitized_file_name = sanitized_file_name + file_object.suffix
    return sanitized_file_name


async def get_file_content(file: UploadFile) -> tuple[bytes, str, str]:
    """Read the content of an uploaded file and return its content, hash, and content type."""
    logger.info(f"get_file_content({file.filename=}, {file.content_type=})")

    # -- Read the file content once
    content = await file.read()

    # -- Generate content hash for deduplication
    content_hash = await calculate_file_hash(file)

    # -- Detect image format
    try:
        with Image.open(io.BytesIO(content)) as img:
            img_format = img.format.lower() if img.format else "jpeg"
            content_type = f"image/{img_format}"
    except Exception as e:
        logger.error(f"Failed to detect image format: {e}")
        content_type = file.content_type or "image/jpeg"

    return content, content_hash, content_type


def create_image_upload_paths(
    db: Session, bt_number: str, segment_id: int, folder_name: str, content_hash: str, file: UploadFile
) -> tuple[str, str]:
    """Generate the full-size and thumbnail paths for an image upload."""
    logger.info(
        f"get_image_upload_paths({bt_number=}, {segment_id=}, {folder_name=}, {content_hash=}, {file.filename=})"
    )

    segment = get_segment_by_id(db, segment_id)

    # -- Validate file
    if not file.filename:
        raise ValueError("File name is missing")

    # -- Create file paths with content hash
    file_ext = Path(file.filename).suffix
    sanitized_material_name = sanitize_file_name_stem(segment.material.name)

    # Use the content hash in the filename
    full_size_path = f"{bt_number}/{folder_name}/{sanitized_material_name}_{content_hash}{file_ext}"
    thumb_path = f"{bt_number}/{folder_name}/thumbnails/{sanitized_material_name}_{content_hash}{file_ext}"

    return full_size_path, thumb_path


def material_photo_file_exists(db: Session, segment_id, content_hash) -> bool:
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


def resize_image_if_needed(
    image_content: bytes,
    content_type: str,
    max_width: int = 1920,
    max_height: int = 1080,
    quality: int = 85
) -> tuple[bytes, bool]:
    """
    Resize an image if it exceeds maximum dimensions.
    
    Args:
        image_content: Original image content as bytes
        content_type: Content type of the image (e.g., 'image/jpeg')
        max_width: Maximum allowed width
        max_height: Maximum allowed height
        quality: JPEG quality (0-100) when saving resized images
        
    Returns:
        tuple: (Resized or original image content as bytes, whether image was resized)
    """
    try:
        # Open the image
        image = Image.open(io.BytesIO(image_content))
        
        # Check current dimensions
        width, height = image.size
        
        # Check if resizing is needed
        if width <= max_width and height <= max_height:
            return image_content, False
            
        # Calculate new dimensions maintaining aspect ratio
        if width / height > max_width / max_height:
            # Width is the limiting factor
            new_width = max_width
            new_height = int(height * (max_width / width))
        else:
            # Height is the limiting factor
            new_height = max_height
            new_width = int(width * (max_height / height))
        
        logger.info(f"Resizing image from {width}x{height} to {new_width}x{new_height}")
        
        image = image.resize((new_width, new_height), Resampling.LANCZOS)
        
        # Convert back to bytes
        img_io = io.BytesIO()
        
        # Determine format from content_type or use original format
        format_name = content_type.split('/')[-1].upper() if content_type else image.format
        if format_name == "JPG":
            format_name = "JPEG"
        
        # Save with appropriate quality
        if format_name == "JPEG":
            image.save(img_io, format=format_name, quality=quality)
        else:
            image.save(img_io, format=format_name)
            
        resized_content = img_io.getvalue()
        logger.info(f"Image resized from {len(image_content)} bytes to {len(resized_content)} bytes")
        
        return resized_content, True
        
    except Exception as e:
        logger.error(f"Failed to resize image: {e}")
        return image_content, False


async def upload_full_size_image(
    content: bytes, content_type: str, bucket_name: str, full_size_path: str, blob_status: dict
) -> str:
    """Upload full-size image after resizing to reasonable dimensions if needed."""
    logger.info(f"upload_full_size_image({bucket_name=}, {full_size_path=})")

    if blob_status["full_exists"]:
        return blob_status["full_url"]

    loop = asyncio.get_running_loop()

    def resize_and_upload():
        # Resize image if needed
        upload_content, was_resized = resize_image_if_needed(content, content_type)
        
        # Upload to GCS
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(full_size_path)
        blob.upload_from_string(upload_content, content_type=content_type)
        blob.make_public()
        return blob.public_url

    return await loop.run_in_executor(None, resize_and_upload)


async def upload_thumbnail_image(content: bytes, bucket_name: str, thumb_path: str, blob_status: dict) -> str:
    """Create and upload thumbnail if needed."""
    logger.info(f"upload_thumbnail_image({bucket_name=}, {thumb_path=})")

    if blob_status["thumb_exists"]:
        return blob_status["thumb_url"]

    loop = asyncio.get_running_loop()

    def do_thumbnail():
        # Create thumbnail
        image = Image.open(io.BytesIO(content))
        image.thumbnail((64, 64))
        thumb_io = io.BytesIO()
        image.save(thumb_io, format="PNG")
        thumb_bytes = thumb_io.getvalue()

        # Upload thumbnail
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        thumb_blob = bucket.blob(thumb_path)
        thumb_blob.upload_from_string(thumb_bytes, content_type="image/png")
        thumb_blob.make_public()
        return thumb_blob.public_url

    return await loop.run_in_executor(None, do_thumbnail)


async def upload_images_to_gcs(
    content: bytes, content_type: str, bucket_name: str, full_size_path: str, thumb_path: str, blob_status: dict
) -> tuple[str, str]:
    """Upload images to GCS and return URLs sequentially.
    
    Note: This function used to run in parallel, but that caused timeouts when run in 
    deployment on Render.com. Now it runs sequentially to ensure reliability. :shrug:
    """
    logger.info(f"upload_images_to_gcs({bucket_name=}, {full_size_path=}, {thumb_path=})")

    try:
        # Upload full image first
        full_size_url = await upload_full_size_image(content, content_type, bucket_name, full_size_path, blob_status)
        logger.info(f"Full size image uploaded successfully: {full_size_url}")
        
        # Then upload thumbnail 
        thumbnail_url = await upload_thumbnail_image(content, bucket_name, thumb_path, blob_status)
        logger.info(f"Thumbnail uploaded successfully: {thumbnail_url}")
        
        return thumbnail_url, full_size_url
        
    except Exception as e:
        logger.error(f"Error during image upload: {e}")
        # Re-raise with more context for better debugging
        raise RuntimeError(f"Failed to upload images to GCS: {e}") from e


async def upload_file_to_gcs(
    db: Session,
    bt_number: str,
    segment_id: int,
    file: UploadFile,
    bucket_name: str,
    folder_name: str,
    file_exists_in_db: Callable[[Session, int, str], bool],
) -> tuple[str, str, str]:
    """Upload an Image-file to Google-Cloud-Storage and return the public URLs."""
    logger.info(f"upload_file_to_gcs({bt_number=}, {segment_id=}, {file.filename=}, {bucket_name=})")

    # Prepare file content and paths
    content, content_hash, content_type = await get_file_content(file)
    full_size_path, thumb_path = create_image_upload_paths(db, bt_number, segment_id, folder_name, content_hash, file)

    # Check if file already exists in DB
    if file_exists_in_db(db, segment_id, content_hash):
        raise FileExistsInDBException()

    # Check if files already exist in GCS
    blob_status = check_gcs_blobs_existence(bucket_name, full_size_path, thumb_path)

    # Upload files (only if needed)
    thumbnail_url, full_size_url = await upload_images_to_gcs(
        content, content_type, bucket_name, full_size_path, thumb_path, blob_status
    )

    return thumbnail_url, full_size_url, content_hash


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


# ---------------------------------------------------------------------------------------
# -- Site Photos


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


# ---------------------------------------------------------------------------------------
# -- Datasheets


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
        raise SitePhotoNotFoundException(datasheet_id)
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

    # TODO: PDF file delete....

    # -- Delete from database
    db.delete(datasheet)
    db.commit()
