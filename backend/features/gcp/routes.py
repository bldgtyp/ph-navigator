# -*- Python Version: 3.11 (Render.com) -*-

import os
import logging

from sqlalchemy.orm import Session
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends

from config import settings
from database import get_db
from db_entities.assembly.segment import Segment
from db_entities.assembly.material_photo import MaterialPhoto
from features.gcp.schemas import SegmentPhotoUploadResponse
from features.gcp.services import upload_segment_photo

router = APIRouter(
    prefix="/gcp",
    tags=["gcp"],
)

logger = logging.getLogger(__name__)


os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "gcp-creds.json"


@router.post(
    "/add-new-segment-photo/{bt_number}", response_model=SegmentPhotoUploadResponse
)
def add_new_segment_photo(
    bt_number: int,
    segment_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        public_url = upload_segment_photo(
            db=db,
            bt_number=bt_number,
            segment_id=segment_id,
            file=file,
            bucket_name=settings.GCP_BUCKET_NAME,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to upload file: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload file")

    return SegmentPhotoUploadResponse(public_url=public_url)

@router.get("/get-thumbnail-urls/{segment_id}")
async def get_thumbnail_urls(
    segment_id: int,
    db: Session = Depends(get_db),
):
    """
    Get the thumbnail URLs for a given segment ID.
    """
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail=f"Segment '{segment_id}' not found")

    # Get each of the MaterialPhotos associated with the segment
    thumbnail_urls = [
        photo.thumbnail_url
        for photo in db.query(MaterialPhoto).filter(MaterialPhoto.segment_id == segment_id).all()
    ]
    logger.info(f"Segment: '{segment_id}' thumbnail URLs: {thumbnail_urls}")

    return {"thumbnail_urls": thumbnail_urls}
