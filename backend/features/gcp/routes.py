# -*- Python Version: 3.11 (Render.com) -*-

import os
import logging

from sqlalchemy.orm import Session
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from google.cloud import storage

from config import settings
from database import get_db
from db_entities.assembly.segment import Segment
from db_entities.assembly.material_photo import MaterialPhoto
from features.gcp.schemas import SegmentPhotoUploadResponse

router = APIRouter(
    prefix="/gcp",
    tags=["gcp"],
)

logger = logging.getLogger(__name__)


os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "gcp-creds.json"


@router.post("/upload-segment-photo/{bt_number}")
def upload_segment_photo(
    bt_number: int,
    segment_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> SegmentPhotoUploadResponse:
    """Uploads a photo for a segment to Google Cloud Storage and creates a MaterialPhoto entity in the DB."""
    logger.info(f"/upload-segment-photo/{bt_number}, {segment_id=}")
    
    # -- Check if the file is provided
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")

    # -- Check if the Segment exists in the DB
    segment = db.get(Segment, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    # -- Compose the destination path
    destination_blob_name = f"{bt_number}/{file.filename}"
    storage_client = storage.Client()
    bucket = storage_client.bucket(settings.GCP_BUCKET_NAME)
    blob = bucket.blob(destination_blob_name)

    # -- Upload the actual file
    logger.info(f"Uploading {file.filename} to {destination_blob_name}")
    try:
        blob.upload_from_file(file.file, content_type=file.content_type)
        blob.make_public()
        public_url = blob.public_url
    except Exception as e:
        logger.error(f"Failed to upload file: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload file")
    

    # -- Create a new MaterialPhoto entity in the DB
    material_photo = MaterialPhoto(
        segment_id=segment.id,
        url=public_url,
    )
    db.add(material_photo)
    db.commit()
    db.refresh(material_photo)

    return SegmentPhotoUploadResponse(public_url=public_url)
