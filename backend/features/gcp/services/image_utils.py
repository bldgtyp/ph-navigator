# -*- Python Version: 3.11 -*-

import io
import logging

from PIL import Image
from PIL.Image import Resampling

logger = logging.getLogger(__name__)

class PDFThumbnailGenerationException(Exception):
    """Custom exception for PDF thumbnail generation failures."""

    def __init__(self, e: Exception):
        self.message = f"Failed to generate PDF thumbnail: {e}"
        logger.error(self.message)
        super().__init__(self.message)


def resize_image(
    image_bytes: bytes,
    content_type: str,
    max_width: int = 1920,
    max_height: int = 1080,
    quality: int = 85
) -> bytes:
    """
    Resize an image if it exceeds maximum dimensions.
    
    Args:
        image_content: Original image content as bytes
        content_type: Content type of the image (e.g., 'image/jpeg')
        max_width: Maximum allowed width
        max_height: Maximum allowed height
        quality: JPEG quality (0-100) when saving resized images
        
    Returns:
        bytes: Resized image content as bytes, or original content if no resizing was needed
    """
    logger.info(f"resize_image({len(image_bytes)=}, {content_type=}, {max_width=}, {max_height=}, {quality=})")

    try:
        # Open the image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Check current dimensions
        width, height = image.size
        
        # Check if resizing is needed
        if width <= max_width and height <= max_height:
            return image_bytes
            
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
        logger.info(f"Image resized from {len(image_bytes)} bytes to {len(resized_content)} bytes")
        
        return resized_content
        
    except Exception as e:
        logger.error(f"Failed to resize image: {e}")
        return image_bytes


def generate_pdf_thumbnail(pdf_bytes: bytes) -> bytes:
    """Generate a thumbnail image from a PDF file."""
    logger.info(f"generate_pdf_thumbnail({len(pdf_bytes)=})")
    
    # ------------------------------------------------------------------------------------------------------------------
    # ------------------------------------------------------------------------------------------------------------------
    # -- Note: In order to avoid seg-fault during test-discovery (pytest), we need to
    # -- import pymupdf here, not at the top of the file.
    import pymupdf
    from pymupdf.utils import get_pixmap
    # ------------------------------------------------------------------------------------------------------------------
    # ------------------------------------------------------------------------------------------------------------------

    try:
        # Load the PDF from bytes
        pdf_document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        
        if pdf_document.page_count == 0:
            raise ValueError("PDF has no pages")
        
        # Get the first page
        first_page = pdf_document[0]
        
        # Render page to an image (with a higher resolution for better quality)
        pix = get_pixmap(page=first_page, matrix=pymupdf.Matrix(1.1, 1.1), alpha=False)
        
        # Convert to PIL Image
        img_data = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_data))
        
        # Resize to thumbnail size
        img.thumbnail((64, 64))
        
        # Save as PNG
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG', optimized=True)
        return img_byte_arr.getvalue()
    except Exception as e:
        raise PDFThumbnailGenerationException(e)


def generate_image_thumbnail(image_bytes: bytes) -> bytes:
    """Generate a thumbnail image from an image file."""
    logger.info(f"generate_image_thumbnail({len(image_bytes)=})")

    image = Image.open(io.BytesIO(image_bytes))
    image.thumbnail((64, 64))
    thumb_io = io.BytesIO()
    image.save(thumb_io, format="PNG")
    return thumb_io.getvalue()

