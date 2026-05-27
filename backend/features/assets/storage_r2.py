"""Cloudflare R2 storage client.

The wrapper is intentionally S3-shaped so tests can use moto and production can
point boto3 at Cloudflare R2 via endpoint_url.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import boto3
from botocore.client import Config

from config import Settings


def asset_object_key(project_id: UUID, asset_id: str, ext: str) -> str:
    clean_ext = ext.lower().lstrip(".") or "bin"
    return f"projects/{project_id}/assets/{asset_id}/file.{clean_ext}"


def asset_thumbnail_object_key(project_id: UUID, asset_id: str) -> str:
    return f"projects/{project_id}/assets/{asset_id}/thumb.png"


def orphaned_asset_object_key(project_id: UUID, asset_id: str, object_key: str) -> str:
    filename = object_key.rsplit("/", maxsplit=1)[-1] or "file.bin"
    return f"projects/{project_id}/assets/_orphaned/{asset_id}/{filename}"


@dataclass(frozen=True)
class DeleteObjectsResult:
    deleted_object_count: int
    failed_object_keys: list[str]


class R2Client:
    def __init__(self, settings: Settings):
        self.bucket = settings.r2_bucket
        endpoint_url = settings.r2_endpoint_url or None
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=settings.r2_access_key_id or "test",
            aws_secret_access_key=settings.r2_secret_access_key or "test",
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )

    def generate_signed_put_url(
        self,
        object_key: str,
        content_type: str,
        size_bytes: int,
        expires_in_seconds: int = 600,
    ) -> str:
        return self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": object_key, "ContentType": content_type},
            ExpiresIn=expires_in_seconds,
        )

    def generate_signed_get_url(
        self,
        object_key: str,
        expires_in_seconds: int,
        response_content_disposition: str | None = None,
    ) -> str:
        params: dict[str, str] = {"Bucket": self.bucket, "Key": object_key}
        if response_content_disposition:
            params["ResponseContentDisposition"] = response_content_disposition
        return self.client.generate_presigned_url("get_object", Params=params, ExpiresIn=expires_in_seconds)

    def head_object(self, object_key: str) -> dict[str, object]:
        return self.client.head_object(Bucket=self.bucket, Key=object_key)

    def get_object_prefix(self, object_key: str, byte_range: tuple[int, int]) -> bytes:
        start, end = byte_range
        response = self.client.get_object(Bucket=self.bucket, Key=object_key, Range=f"bytes={start}-{end}")
        return bytes(response["Body"].read())

    def get_object(self, object_key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=object_key)
        return bytes(response["Body"].read())

    def put_object(self, object_key: str, body: bytes, content_type: str) -> str:
        response = self.client.put_object(Bucket=self.bucket, Key=object_key, Body=body, ContentType=content_type)
        return str(response.get("ETag", "")).strip('"')

    def copy_object(self, source_key: str, dest_key: str) -> None:
        self.client.copy_object(Bucket=self.bucket, CopySource={"Bucket": self.bucket, "Key": source_key}, Key=dest_key)

    def delete_object(self, object_key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=object_key)

    def list_object_keys(self, prefix: str) -> list[str]:
        keys: list[str] = []
        continuation_token: str | None = None
        while True:
            params: dict[str, object] = {"Bucket": self.bucket, "Prefix": prefix}
            if continuation_token:
                params["ContinuationToken"] = continuation_token
            response = self.client.list_objects_v2(**params)
            keys.extend(str(item["Key"]) for item in response.get("Contents", []))
            if not response.get("IsTruncated"):
                return keys
            continuation_token = str(response.get("NextContinuationToken", ""))

    def delete_objects(self, object_keys: list[str]) -> DeleteObjectsResult:
        deleted = 0
        failed: list[str] = []
        for index in range(0, len(object_keys), 1000):
            chunk = object_keys[index : index + 1000]
            if not chunk:
                continue
            response = self.client.delete_objects(
                Bucket=self.bucket,
                Delete={"Objects": [{"Key": key} for key in chunk], "Quiet": False},
            )
            deleted += len(response.get("Deleted", []))
            failed.extend(str(item.get("Key", "")) for item in response.get("Errors", []))
        return DeleteObjectsResult(deleted_object_count=deleted, failed_object_keys=[key for key in failed if key])
