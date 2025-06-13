# -*- Python Version: 3.11 -*-

import io
import hashlib
import logging
from pathlib import Path
from dataclasses import dataclass

from fastapi import UploadFile
from PIL import Image


logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class FileContent:
    filename: str
    filename_suffix: str
    content: bytes
    content_hash: str
    content_type: str


def valid_upload_file_type(file_type: str, valid_extensions: list[str], content_type: str) -> bool:
    """Validate that the file is a supported format (ie: .PNG, .JPEG, .PDF).

    Args:
        file_type (str): The file type (extension) of the uploaded file
        valid_extensions (list[str]): List of valid file extensions (e.g., ['.png', '.jpg', '.jpeg', '.pdf'])
        content_type (str): The content type of the uploaded file

    Returns:
        bool: True if the file is a valid image type, False otherwise
    """
    logger.info(f"validate_image_file_type({file_type=}, {valid_extensions=}, {content_type=})")
    VALID_CONTENT_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"]

    # Check file extension
    has_valid_extension = file_type.lower() in valid_extensions

    # Check content type
    has_valid_content_type = content_type.lower() in VALID_CONTENT_TYPES

    return has_valid_extension and has_valid_content_type


def valid_file_size(file_content_bytes: bytes, max_size_mb: int = 5) -> bool:
    """Check if file is within the size limit."""
    logger.info(f"validate_file_size({len(file_content_bytes)=}, {max_size_mb=})")
    
    max_size_bytes = max_size_mb * 1024 * 1024  # Convert MB to bytes
    file_size = len(file_content_bytes)
    if file_size > max_size_bytes:
        logger.warning(f"File size {file_size} exceeds the limit of {max_size_bytes} bytes.")
        return False
    return True


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


async def get_file_content(file: UploadFile) -> FileContent:
    """Read the content of an uploaded file and return its content, hash, and content type."""
    logger.info(f"get_file_content({file.filename=})")

    # -- Validate the file
    if not file.filename:
        raise ValueError("File must have a valid filename")
    file_path = Path(file.filename)

    # -- Read the file content once
    content = await file.read()

    file_content_hash = await calculate_file_hash(file)

    # -- Detect image format
    try:
        with Image.open(io.BytesIO(content)) as img:
            img_format = img.format.lower() if img.format else "jpeg"
            content_type = f"image/{img_format}"
    except Exception as e:
        logger.error(f"Failed to detect image format: {e}")
        content_type = file.content_type or "image/jpeg"

    return FileContent(file_path.name, file_path.suffix, content, file_content_hash, content_type)