# -*- Python Version: 3.11 (Render.com) -*-

import os
import logging

from sqlalchemy.orm import Session
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends

from config import settings
from database import get_db
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
