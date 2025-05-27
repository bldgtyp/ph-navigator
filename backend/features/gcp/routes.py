# -*- Python Version: 3.11 (Render.com) -*-

import logging
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from db_entities.assembly.material_datasheet import MaterialDatasheet
from db_entities.assembly.material_photo import MaterialPhoto
from db_entities.assembly.segment import Segment
from features.assembly.schemas.material_datasheet import MaterialDatasheetSchema
from features.assembly.schemas.material_photo import MaterialPhotoSchema
from features.gcp.schemas import (
    SegmentDatasheetUrlResponse,
    SegmentSitePhotoUrlsResponse,
)
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


@router.post(
    "/add-new-segment-site-photo/{bt_number}",
    response_model=MaterialPhotoSchema,
)
async def add_new_segment_site_photo(
    bt_number: str,
    segment_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> MaterialPhotoSchema:
    """Upload a new site photo for a segment."""
    logger.info(
        f"add_new_segment_site_photo(bt_number={bt_number}, segment_id={segment_id})"
    )

    try:
        thumbnail_url, full_size_url = await upload_segment_site_photo_to_cdn(
            db=db,
            bt_number=bt_number,
            segment_id=segment_id,
            file=file,
            bucket_name=settings.GCP_BUCKET_NAME,
        )
        new_material_photo = await add_site_photo_to_segment(
            db, segment_id, thumbnail_url, full_size_url
        )
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


@router.get(
    "/get-site-photo-urls/{segment_id}",
    response_model=SegmentSitePhotoUrlsResponse,
)
async def get_site_photo_urls(
    segment_id: int,
    db: Session = Depends(get_db),
) -> SegmentSitePhotoUrlsResponse:
    """Get the site-photo thumbnail URLs for a given segment ID."""
    logger.info(f"get_site_photo_urls(segment_id={segment_id})")

    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail=f"Segment '{segment_id}' not found")

    segment_photos = (
        db.query(MaterialPhoto).filter(MaterialPhoto.segment_id == segment_id).all()
    )

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


@router.post(
    "/add-new-segment-datasheet/{bt_number}",
    response_model=MaterialDatasheetSchema,
)
async def add_new_segment_datasheet(
    bt_number: str,
    segment_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> MaterialDatasheetSchema:
    """Upload a new datasheet file for a segment."""
    logger.info(
        f"add_new_segment_datasheet(bt_number={bt_number}, segment_id={segment_id})"
    )

    try:
        thumbnail_url, full_size_url = await upload_segment_datasheet_to_cdn(
            db=db,
            bt_number=bt_number,
            segment_id=segment_id,
            file=file,
            bucket_name=settings.GCP_BUCKET_NAME,
        )
        new_material_datasheet = await add_datasheet_to_segment(
            db, segment_id, thumbnail_url, full_size_url
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to upload file: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload file")

    return MaterialDatasheetSchema(
        id=new_material_datasheet.id,
        segment_id=new_material_datasheet.segment_id,
        full_size_url=new_material_datasheet.full_size_url,
        thumbnail_url=new_material_datasheet.thumbnail_url,
    )


@router.get(
    "/get-datasheet-urls/{segment_id}",
    response_model=SegmentDatasheetUrlResponse,
)
async def get_datasheet_thumbnail_urls(
    segment_id: int,
    db: Session = Depends(get_db),
) -> SegmentDatasheetUrlResponse:
    """Get the datasheet thumbnail URLs for a given segment ID."""
    logger.info(f"get_datasheet_thumbnail_urls(segment_id={segment_id})")

    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail=f"Segment '{segment_id}' not found")

    datasheets = (
        db.query(MaterialDatasheet)
        .filter(MaterialDatasheet.segment_id == segment_id)
        .all()
    )

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
