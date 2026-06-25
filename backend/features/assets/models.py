"""Pydantic models for project asset routes."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from features.assets.registry import AssetKind


class AssetMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")

    thumbnail_object_key: str | None = None
    thumbnail_status: Literal["ready", "pending", "failed", "na"] | None = None
    thumbnail_failure_reason: str | None = None
    page_count: int | None = None
    image_dimensions: tuple[int, int] | None = None
    epw_location: dict[str, Any] | None = None


class AssetRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    project_id: str
    asset_kind: AssetKind
    object_key: str
    original_filename: str
    display_name: str
    content_type: str
    size_bytes: int
    content_hash_sha256: str
    r2_etag: str | None = None
    upload_status: Literal["pending", "uploaded", "failed"]
    created_at: datetime
    created_by: str
    uploaded_at: datetime | None = None
    deleted_at: datetime | None = None
    deleted_by: str | None = None
    metadata: AssetMetadata = Field(default_factory=AssetMetadata)


class UploadIntentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_kind: AssetKind
    original_filename: str = Field(min_length=1, max_length=500)
    content_type: str = Field(min_length=1, max_length=200)
    size_bytes: int = Field(ge=0)
    content_hash_sha256: str = Field(pattern=r"^[A-Fa-f0-9]{64}$")
    display_name: str | None = Field(default=None, max_length=500)


class UploadIntentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset: AssetRow
    upload_url: str | None
    expires_at: datetime | None
    duplicate_of: str | None = None


class BulkUploadIntentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[UploadIntentRequest] = Field(min_length=1, max_length=50)


class BulkUploadIntentItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    index: int
    asset_id: str | None = None
    upload_url: str | None = None
    expires_at: datetime | None = None
    duplicate_of: str | None = None
    error_code: str | None = None
    message: str | None = None


class BulkUploadIntentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[BulkUploadIntentItem]


class AssetUrlsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: str
    preview_url: str
    preview_expires_at: datetime
    download_url: str
    download_expires_at: datetime
    thumbnail_url: str | None = None
    thumbnail_status: str | None = None
    thumbnail_expires_at: datetime | None = None
    content_type: str
    original_filename: str
    display_name: str
    size_bytes: int


class BulkAssetUrlsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[AssetUrlsResponse]


class PatchAssetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, min_length=1, max_length=500)


class AttachAssetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version_id: str
    table_key: str
    row_id: str
    field_key: str
    index: int | None = None
    if_match: str | None = None
    if_match_version: str | None = None
    op_group_id: str | None = None


class DetachAssetRequest(AttachAssetRequest):
    pass


class BulkDownloadFilter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    table_key: str | None = None
    column_key: str | None = None
    asset_ids: list[str] | None = None
    kind: AssetKind | None = None


class BulkDownloadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filter: BulkDownloadFilter = Field(default_factory=BulkDownloadFilter)
    filename_pattern: str = "{table}/{row.name}__{filename}"
    include_manifest_csv: bool = True


class JobResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    project_id: str
    job_type: str
    status: str
    progress: int
    created_by: str
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    result_asset_id: str | None = None
    error_code: str | None = None
    error_details: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    status_url: str | None = None
