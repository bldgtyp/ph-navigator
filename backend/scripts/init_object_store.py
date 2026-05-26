"""Initialize the local S3-compatible object store for attachment development."""

from __future__ import annotations

import os

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from config import settings

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


def main() -> None:
    endpoint_url = settings.r2_endpoint_url
    if not endpoint_url:
        raise SystemExit("R2_ENDPOINT_URL is required for local object-store initialization.")

    client = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=settings.r2_access_key_id or "phn_minio",
        aws_secret_access_key=settings.r2_secret_access_key or "phn_minio_local_only",
        region_name="auto",
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )

    bucket = settings.r2_bucket
    try:
        client.head_bucket(Bucket=bucket)
    except ClientError:
        client.create_bucket(Bucket=bucket)

    origins = [
        item.strip()
        for item in os.getenv("OBJECT_STORE_CORS_ORIGINS", ",".join(DEFAULT_CORS_ORIGINS)).split(",")
        if item.strip()
    ]
    try:
        client.put_bucket_cors(
            Bucket=bucket,
            CORSConfiguration={
                "CORSRules": [
                    {
                        "AllowedHeaders": ["*"],
                        "AllowedMethods": ["GET", "HEAD", "PUT"],
                        "AllowedOrigins": origins,
                        "ExposeHeaders": ["ETag"],
                        "MaxAgeSeconds": 3600,
                    }
                ]
            },
        )
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code != "NotImplemented":
            raise
        print(
            "object store warning: bucket CORS API is not supported by this "
            "local endpoint; relying on server-level CORS configuration"
        )
    print(f"object store ready: bucket={bucket} endpoint={endpoint_url}")


if __name__ == "__main__":
    main()
