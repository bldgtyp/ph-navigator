# -*- Python Version: 3.11 -*-

import logging
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from config import limiter, settings
from database import get_db
from features.assembly.schemas.material_datasheet import MaterialDatasheetSchema
from features.assembly.schemas.material_photo import MaterialPhotoSchema
from features.assembly.services.segment import SegmentNotFoundException
from features.gcp.schemas import SegmentDatasheetUrlResponse, SegmentSitePhotoUrlsResponse
from features.gcp.services import (
    DatasheetNotFoundException,
    SitePhotoNotFoundException,
    add_datasheet_to_segment,
    add_site_photo_to_segment,
    delete_datasheet,
    delete_site_photo,
    get_datasheet_by_id,
    get_segment_datasheets,
    get_segment_site_photos,
    get_site_photo_by_id,
    material_datasheet_file_exists,
    material_photo_file_exists,
    upload_file_to_gcs,
    validate_upload_file_type,
)

router = APIRouter(
    prefix="/gcp",
    tags=["gcp"],
)

logger = logging.getLogger(__name__)


os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "gcp-creds.json"


class UnsupportedFileTypeException(Exception):
    """Custom exception for unsupported file types."""

    def __init__(self, filename: str | None, content_type: str | None, valid_extensions: list[str]):
        self.message = (
            f"File {filename} with type {content_type} is not supported. Only {valid_extensions} files are allowed."
        )
        logger.error(self.message)
        super().__init__(self.message)


# ----------------------------------------------------------------------------------------------------------------------
# -- Site Photos


# TODO: pass just the segment ID, not a whole form?
@router.post("/add-new-segment-site-photo/{bt_number}", response_model=MaterialPhotoSchema)
@limiter.limit("10/minute")
async def add_new_segment_site_photo_route(
    request: Request,
    bt_number: str,
    segment_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> MaterialPhotoSchema | None:
    """Upload a new site photo for a segment."""
    logger.info(f"gcp/add_new_segment_site_photo_route(bt_number={bt_number}, segment_id={segment_id})")

    try:
        valid_extensions = [".jpg", ".jpeg", ".png"]
        if not validate_upload_file_type(file, valid_extensions):
            raise UnsupportedFileTypeException(file.filename, file.content_type, valid_extensions)

        thumbnail_url, full_size_url, content_hash = await upload_file_to_gcs(
            db=db,
            bt_number=bt_number,
            segment_id=segment_id,
            file=file,
            bucket_name=settings.GCP_BUCKET_NAME,
            folder_name="site_photos",
            file_exists_in_db=material_photo_file_exists,
        )
        new_material_photo = add_site_photo_to_segment(
            db=db,
            segment_id=segment_id,
            thumbnail_url=thumbnail_url,
            full_size_url=full_size_url,
            content_hash=content_hash,
        )
        return MaterialPhotoSchema(
            id=new_material_photo.id,
            segment_id=new_material_photo.segment_id,
            full_size_url=new_material_photo.full_size_url,
            thumbnail_url=new_material_photo.thumbnail_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        msg = f"Failed to upload file: {e}"
        logger.error(msg)
        raise HTTPException(status_code=500, detail=msg)


@router.get("/get-site-photo-urls/{segment_id}", response_model=SegmentSitePhotoUrlsResponse)
def get_site_photo_urls_route(
    request: Request, segment_id: int, db: Session = Depends(get_db)
) -> SegmentSitePhotoUrlsResponse:
    """Get the site-photo thumbnail URLs for a given segment ID."""
    logger.info(f"gcp/get_site_photo_urls_route(segment_id={segment_id})")

    try:
        segment_photos = get_segment_site_photos(db, segment_id)
        return SegmentSitePhotoUrlsResponse(
            photo_urls=[
                MaterialPhotoSchema(
                    id=photo.id,
                    segment_id=photo.segment_id,
                    full_size_url=photo.full_size_url,
                    thumbnail_url=photo.thumbnail_url,
                )
                for photo in segment_photos
            ]
        )
    except SegmentNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        msg = f"Failed to retrieve site photos: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


@router.delete("/delete-segment-site-photo/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_segment_site_photo_route(
    request: Request,
    photo_id: int,
    db: Session = Depends(get_db),
) -> None:
    """Delete a photo associated with a segment."""
    logger.info(f"gcp/delete_segment_site_photo_route(photo_id={photo_id})")

    try:
        photo = get_site_photo_by_id(db, photo_id)
        await delete_site_photo(db, photo)
        logger.info(f"Successfully deleted '{photo_id=}' and its associated files")
    except SitePhotoNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)
    except Exception as e:
        msg = f"Failed to delete photo: {e}"
        logger.error(msg)
        db.rollback()
        raise HTTPException(status_code=500, detail=msg)


# ----------------------------------------------------------------------------------------------------------------------
# -- Datasheets


# TODO: pass just the segment ID, not a whole form?
@router.post("/add-new-segment-datasheet/{bt_number}", response_model=MaterialDatasheetSchema)
@limiter.limit("10/minute")
async def add_new_segment_datasheet_route(
    request: Request,
    bt_number: str,
    segment_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> MaterialDatasheetSchema:
    """Upload a new datasheet file for a segment."""
    logger.info(f"gcp/add_new_segment_datasheet_route(bt_number={bt_number}, segment_id={segment_id})")

    try:
        valid_extensions = [".jpg", ".jpeg", ".png", ".pdf"]
        if not validate_upload_file_type(file, valid_extensions):
            raise UnsupportedFileTypeException(file.filename, file.content_type, valid_extensions)

        thumbnail_url, full_size_url, content_hash = await upload_file_to_gcs(
            db=db,
            bt_number=bt_number,
            segment_id=segment_id,
            file=file,
            bucket_name=settings.GCP_BUCKET_NAME,
            folder_name="datasheets",
            file_exists_in_db=material_datasheet_file_exists,
        )
        new_material_datasheet = add_datasheet_to_segment(
            db=db,
            segment_id=segment_id,
            thumbnail_url=thumbnail_url,
            full_size_url=full_size_url,
            content_hash=content_hash,
        )
        return MaterialDatasheetSchema(
            id=new_material_datasheet.id,
            segment_id=new_material_datasheet.segment_id,
            full_size_url=new_material_datasheet.full_size_url,
            thumbnail_url=new_material_datasheet.thumbnail_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        msg = f"Failed to upload file: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


@router.get("/get-segment-datasheet-urls/{segment_id}", response_model=SegmentDatasheetUrlResponse)
async def get_segment_datasheet_urls_route(
    request: Request,
    segment_id: int,
    db: Session = Depends(get_db),
) -> SegmentDatasheetUrlResponse:
    """Get the datasheet thumbnail URLs for a given segment ID."""
    logger.info(f"gcp/get_segment_datasheet_urls_route(segment_id={segment_id})")

    try:
        datasheets = get_segment_datasheets(db, segment_id)
        return SegmentDatasheetUrlResponse(
            datasheet_urls=[
                MaterialDatasheetSchema(
                    id=datasheet.id,
                    segment_id=datasheet.segment_id,
                    full_size_url=datasheet.full_size_url,
                    thumbnail_url=datasheet.thumbnail_url,
                )
                for datasheet in datasheets
            ]
        )
    except SegmentNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        msg = f"Failed to retrieve site photos: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


@router.delete("/delete-segment-datasheet/{datasheet_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_segment_datasheet_route(
    request: Request,
    datasheet_id: int,
    db: Session = Depends(get_db),
) -> None:
    """Delete a datasheet associated with a segment."""
    logger.info(f"gcp/delete_segment_datasheet_route(datasheet_id={datasheet_id})")

    try:
        datasheet = get_datasheet_by_id(db, datasheet_id)
        await delete_datasheet(db, datasheet)
        logger.info(f"Successfully deleted '{datasheet_id=}' and its associated files")
    except DatasheetNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)
    except Exception as e:
        msg = f"Failed to delete datasheet: {e}"
        logger.error(msg)
        db.rollback()
        raise HTTPException(status_code=500, detail=msg)
