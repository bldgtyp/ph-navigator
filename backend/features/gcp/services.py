# -*- Python Version: 3.11 (Render.com) -*-

import logging

from google.cloud import storage

from config import settings

logger = logging.getLogger(__name__)


def check_gcs_bucket_create_file_permissions() -> bool:
    """Check if the service account has permission to write to the bucket."""

    storage_client = storage.Client()
    bucket = storage_client.bucket(settings.GCP_BUCKET_NAME)
    permissions = ["storage.objects.create"]
    result = bucket.test_iam_permissions(permissions)

    logger.info(f"Permissions result: {result}")

    return "storage.objects.create" in result
