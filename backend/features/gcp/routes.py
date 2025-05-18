# -*- Python Version: 3.11 (Render.com) -*-

import os
from datetime import timedelta
import logging

from fastapi import APIRouter, Form
from google.cloud import storage

from config import settings

router = APIRouter(
    prefix="/gcp",
    tags=["gcp"],
)

logger = logging.getLogger(__name__)


os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "gcp-creds.json"


@router.post("/generate-upload-url/{bt_number}")
def generate_upload_url(bt_number: int, filename: str = Form(...)):
    """Generate a signed URL for uploading a file to Google Cloud Storage."""
    logger.info(f"gcp/generate-upload-url{filename}")

    storage_client = storage.Client()
    bucket = storage_client.bucket(settings.GCP_BUCKET_NAME)
    blob = bucket.blob(f"{bt_number}/{filename}")
    # blob.make_public()

    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=15),
        method="PUT",
        content_type="application/octet-stream",
    )
    
    logger.info(f"Generated URL: {url}")
    
    return {"url": url}