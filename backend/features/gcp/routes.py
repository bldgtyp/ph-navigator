# -*- Python Version: 3.11 -*-

import logging
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from db_entities.assembly.material_datasheet import MaterialDatasheet
from db_entities.assembly.material_photo import MaterialPhoto
from db_entities.assembly.segment import Segment
from features.assembly.schemas.material_datasheet import MaterialDatasheetSchema
from features.assembly.schemas.material_photo import MaterialPhotoSchema
from features.gcp.schemas import SegmentDatasheetUrlResponse, SegmentSitePhotoUrlsResponse
from features.gcp.services import (
    add_datasheet_to_segment,
    add_site_photo_to_segment,
    upload_segment_datasheet_to_cdn,
    upload_segment_site_photo_to_cdn,
)

router = APIRouter(
    prefix="/gcp",
    tags=["gcp"],
)

logger = logging.getLogger(__name__)


os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "gcp-creds.json"


# TODO: make these routes all async
# TODO: pass just the segment ID, not a whole form?
@router.post("/add-new-segment-site-photo/{bt_number}", response_model=MaterialPhotoSchema)
def add_new_segment_site_photo_route(
    bt_number: str,
    segment_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> MaterialPhotoSchema:
    """Upload a new site photo for a segment."""
    logger.info(f"gcp/add_new_segment_site_photo_route(bt_number={bt_number}, segment_id={segment_id})")

    try:
        thumbnail_url, full_size_url = upload_segment_site_photo_to_cdn(
            db=db,
            bt_number=bt_number,
            segment_id=segment_id,
            file=file,
            bucket_name=settings.GCP_BUCKET_NAME,
        )
        new_material_photo = add_site_photo_to_segment(db, segment_id, thumbnail_url, full_size_url)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to upload file: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload file")

    return MaterialPhotoSchema(
        id=new_material_photo.id,
        segment_id=new_material_photo.segment_id,
        full_size_url=new_material_photo.full_size_url,
        thumbnail_url=new_material_photo.thumbnail_url,
    )


# TODO: Move to service
@router.get("/get-site-photo-urls/{segment_id}", response_model=SegmentSitePhotoUrlsResponse)
def get_site_photo_urls_route(segment_id: int, db: Session = Depends(get_db)) -> SegmentSitePhotoUrlsResponse:
    """Get the site-photo thumbnail URLs for a given segment ID."""
    logger.info(f"gcp/get_site_photo_urls_route(segment_id={segment_id})")

    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Segment '{segment_id}' not found")

    segment_photos = db.query(MaterialPhoto).filter(MaterialPhoto.segment_id == segment_id).all()

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


# TODO: pass just the segment ID, not a whole form?
@router.post("/add-new-segment-datasheet/{bt_number}", response_model=MaterialDatasheetSchema)
async def add_new_segment_datasheet_route(
    bt_number: str,
    segment_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> MaterialDatasheetSchema:
    """Upload a new datasheet file for a segment."""
    logger.info(f"gcp/add_new_segment_datasheet_route(bt_number={bt_number}, segment_id={segment_id})")

    try:
        thumbnail_url, full_size_url = upload_segment_datasheet_to_cdn(
            db=db,
            bt_number=bt_number,
            segment_id=segment_id,
            file=file,
            bucket_name=settings.GCP_BUCKET_NAME,
        )
        new_material_datasheet = add_datasheet_to_segment(db, segment_id, thumbnail_url, full_size_url)
        return MaterialDatasheetSchema(
            id=new_material_datasheet.id,
            segment_id=new_material_datasheet.segment_id,
            full_size_url=new_material_datasheet.full_size_url,
            thumbnail_url=new_material_datasheet.thumbnail_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to upload file: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to upload file")


@router.get("/get-datasheet-urls/{segment_id}", response_model=SegmentDatasheetUrlResponse)
async def get_datasheet_thumbnail_urls_route(
    segment_id: int,
    db: Session = Depends(get_db),
) -> SegmentDatasheetUrlResponse:
    """Get the datasheet thumbnail URLs for a given segment ID."""
    logger.info(f"gcp/get_datasheet_thumbnail_urls_route(segment_id={segment_id})")

    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail=f"Segment '{segment_id}' not found")

    datasheets = db.query(MaterialDatasheet).filter(MaterialDatasheet.segment_id == segment_id).all()

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


# TODO: Add Delete endpoints for photos and datasheets