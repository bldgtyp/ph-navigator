"""Asset workflow service: upload intents, completion, URLs, draft attachment, and bulk jobs."""

from __future__ import annotations

import hashlib
import json
from contextlib import suppress
from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import UUID

from fastapi import BackgroundTasks
from psycopg import Connection
from starlette import status

from config import settings
from database import connection, transaction
from features.assets import repository
from features.assets.base import (
    AssetStorage,
    AssetThumbnailer,
    asset_not_found,
    generated_asset_id,
    location_asset_ids_for_project,
)
from features.assets.downloads import AssetBulkDownloadWorkflow, find_row
from features.assets.heic_conversion import (
    AssetConversionError,
    convert_heic_upload_to_jpeg,
    is_heic_content_type,
    prefix_looks_like_heic,
)
from features.assets.mapping import asset_row, asset_row_or_none, asset_rows
from features.assets.models import (
    AssetRow,
    AssetUrlsResponse,
    BulkUploadIntentItem,
    BulkUploadIntentResponse,
    UploadIntentRequest,
    UploadIntentResponse,
)
from features.assets.orphan_sweeper import AssetOrphanSweepWorkflow
from features.assets.registry import (
    DATASHEET_FIELD_KEY,
    PHOTO_FIELD_KEY,
    WEATHER_FILE_KINDS,
    all_asset_kinds,
    asset_matches_field,
    attachment_fields_for_asset_kind,
    filename_extension,
    get_attachment_field,
    hbjson_upload_allowed,
    list_asset_references,
    weather_file_upload_allowed,
)
from features.assets.storage_r2 import asset_object_key
from features.project_document import repository as document_repository
from features.project_document.store import get_saved_document
from features.project_document.validation import (
    enforce_document_body_size,
    next_draft_etag_from_etag,
    validate_document,
)
from features.project_document.write_spine import load_draft_context
from features.project_location.epw import epw_header_looks_valid
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error

ATTACHMENT_STATUS_FIELD_BY_ASSET_FIELD = {
    DATASHEET_FIELD_KEY: "datasheet_status",
    PHOTO_FIELD_KEY: "photo_status",
}


class AssetService(AssetBulkDownloadWorkflow, AssetOrphanSweepWorkflow):
    def __init__(self, r2: AssetStorage, thumbnailer: AssetThumbnailer):
        self.r2 = r2
        self.thumbnailer = thumbnailer

    def create_upload_intent(self, access: ProjectAccess, payload: UploadIntentRequest) -> UploadIntentResponse:
        """Reserve an asset row and mint a 10-minute signed PUT URL.

        Single DB transaction so deduplication-by-content-hash and the
        pending-row insert see a consistent snapshot — without this, two
        concurrent uploads of the same file could both insert a pending
        row before either sees the other. R2 sign-URL minting happens
        outside the transaction (no side effect to compensate for if the
        commit fails). Returns the existing asset with
        ``upload_url=None`` when a duplicate content hash already exists.
        """
        user = require_editor_user(access)
        self._validate_upload_intent_payload(payload)
        ext = filename_extension(payload.original_filename).lstrip(".") or _extension_from_content_type(
            payload.content_type
        )
        asset_id = generated_asset_id()
        object_key = asset_object_key(access.project_id, asset_id, ext)
        with transaction() as conn:
            duplicate = asset_row_or_none(
                repository.find_asset_by_content_hash(conn, access.project_id, payload.content_hash_sha256)
            )
            if duplicate is not None:
                return UploadIntentResponse(
                    asset=duplicate, upload_url=None, expires_at=None, duplicate_of=duplicate.id
                )
            asset = asset_row(
                repository.insert_pending_asset(
                    conn,
                    asset_id=asset_id,
                    project_id=access.project_id,
                    asset_kind=payload.asset_kind,
                    object_key=object_key,
                    original_filename=payload.original_filename,
                    display_name=payload.display_name or payload.original_filename,
                    content_type=payload.content_type,
                    size_bytes=payload.size_bytes,
                    content_hash_sha256=payload.content_hash_sha256,
                    created_by=user.id,
                )
            )
        expires_at = datetime.now(tz=UTC) + timedelta(minutes=10)
        return UploadIntentResponse(
            asset=asset,
            upload_url=self.r2.generate_signed_put_url(object_key, payload.content_type, payload.size_bytes),
            expires_at=expires_at,
        )

    def create_uploaded_asset_from_bytes(
        self,
        *,
        project_id: UUID,
        created_by: UUID,
        asset_kind: str,
        original_filename: str,
        display_name: str,
        content_type: str,
        body: bytes,
        metadata: dict[str, Any] | None = None,
    ) -> AssetRow:
        """Create an already-uploaded asset from trusted server-side bytes."""
        asset_id = generated_asset_id()
        ext = filename_extension(original_filename).lstrip(".") or _extension_from_content_type(content_type)
        object_key = asset_object_key(project_id, asset_id, ext)
        digest = hashlib.sha256(body).hexdigest()
        r2_etag = self.r2.put_object(object_key, body, content_type)
        with transaction() as conn:
            repository.insert_pending_asset(
                conn,
                asset_id=asset_id,
                project_id=project_id,
                asset_kind=asset_kind,
                object_key=object_key,
                original_filename=original_filename,
                display_name=display_name,
                content_type=content_type,
                size_bytes=len(body),
                content_hash_sha256=digest,
                created_by=created_by,
            )
            uploaded = asset_row(repository.mark_asset_uploaded(conn, project_id, asset_id, r2_etag=r2_etag))
            if metadata is not None:
                uploaded = asset_row(repository.set_asset_metadata(conn, project_id, asset_id, metadata))
        return uploaded

    def create_bulk_upload_intent(
        self,
        access: ProjectAccess,
        items: list[UploadIntentRequest],
    ) -> BulkUploadIntentResponse:
        out: list[BulkUploadIntentItem] = []
        for index, item in enumerate(items):
            try:
                response = self.create_upload_intent(access, item)
                out.append(
                    BulkUploadIntentItem(
                        index=index,
                        asset_id=response.asset.id,
                        upload_url=response.upload_url,
                        expires_at=response.expires_at,
                        duplicate_of=response.duplicate_of,
                    )
                )
            except Exception as exc:
                detail = getattr(exc, "detail", None)
                if isinstance(detail, dict):
                    out.append(
                        BulkUploadIntentItem(
                            index=index,
                            error_code=str(detail.get("error_code", "asset_upload_intent_failed")),
                            message=str(detail.get("message", "Upload intent failed.")),
                        )
                    )
                else:
                    out.append(
                        BulkUploadIntentItem(index=index, error_code="asset_upload_intent_failed", message=str(exc))
                    )
        return BulkUploadIntentResponse(items=out)

    def complete_upload(self, access: ProjectAccess, asset_id: str, background_tasks: BackgroundTasks) -> AssetRow:
        """Verify a finished R2 upload and flip the asset to ``uploaded``.

        R2 HEAD/sniff/conversion happen outside a DB transaction so network and
        image-decoding work never holds a row lock. Success writes one final
        asset-row update, then thumbnailing runs best-effort in the background.
        """
        require_editor_user(access)
        with connection() as conn:
            asset = asset_row_or_none(repository.get_asset_by_id(conn, access.project_id, asset_id))
        if asset is None:
            raise asset_not_found()
        try:
            head = self.r2.head_object(asset.object_key)
            size = int(cast(int | str, head.get("ContentLength", -1)))
            if size != asset.size_bytes:
                raise ValueError("size_mismatch")
            prefix = self.r2.get_object_prefix(asset.object_key, (0, min(asset.size_bytes, 8191)))
            self._validate_magic(asset, prefix)
            converted = None
            if is_heic_content_type(asset.content_type):
                converted = convert_heic_upload_to_jpeg(asset, self.r2)
        except AssetConversionError as exc:
            with transaction() as conn:
                repository.mark_asset_failed(conn, access.project_id, asset_id, reason="asset_conversion_failed")
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "asset_conversion_failed",
                "Uploaded HEIC/HEIF image could not be converted to JPEG.",
                {"asset_id": asset_id, "reason": str(exc)},
            ) from exc
        except Exception as exc:
            with transaction() as conn:
                repository.mark_asset_failed(conn, access.project_id, asset_id, reason=str(exc))
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "asset_mime_not_allowed",
                "Uploaded file does not match the declared content type or policy.",
                {"asset_id": asset_id, "reason": str(exc)},
            ) from exc

        if converted is None:
            with transaction() as conn:
                uploaded = asset_row(
                    repository.mark_asset_uploaded(
                        conn,
                        access.project_id,
                        asset_id,
                        r2_etag=str(head.get("ETag", "")).strip('"'),
                    )
                )
        else:
            converted_object, r2_etag = converted
            with transaction() as conn:
                uploaded = asset_row(
                    repository.mark_converted_asset_uploaded(
                        conn,
                        access.project_id,
                        asset_id,
                        object_key=converted_object.object_key,
                        content_type=converted_object.content_type,
                        size_bytes=converted_object.size_bytes,
                        content_hash_sha256=converted_object.content_hash_sha256,
                        r2_etag=r2_etag,
                        metadata_patch={
                            "converted_from_content_type": asset.content_type,
                            "converted_from_object_key": asset.object_key,
                            "converted_from_content_hash_sha256": asset.content_hash_sha256,
                            "conversion": "heic_to_jpeg",
                        },
                    )
                )
            with suppress(Exception):
                self.r2.delete_object(asset.object_key)
        if uploaded.asset_kind != "epw":
            background_tasks.add_task(self.thumbnailer.render_for_asset, access.project_id, asset_id)
        return uploaded

    def get_asset(self, access: ProjectAccess, asset_id: str) -> AssetRow:
        with connection() as conn:
            asset = asset_row_or_none(repository.get_asset_by_id(conn, access.project_id, asset_id))
        if asset is None:
            raise asset_not_found()
        return asset

    def read_asset_prefix(self, access: ProjectAccess, asset_id: str, byte_count: int) -> tuple[AssetRow, bytes]:
        asset = self.get_asset(access, asset_id)
        if asset.upload_status != "uploaded":
            raise api_error(status.HTTP_409_CONFLICT, "asset_upload_incomplete", "Asset upload is not complete.")
        return asset, self.r2.get_object_prefix(asset.object_key, (0, max(0, byte_count - 1)))

    def set_metadata(self, access: ProjectAccess, asset_id: str, metadata_patch: dict[str, Any]) -> AssetRow:
        require_editor_user(access)
        with transaction() as conn:
            try:
                return asset_row(repository.set_asset_metadata(conn, access.project_id, asset_id, metadata_patch))
            except LookupError as exc:
                raise asset_not_found() from exc

    def list_assets(self, access: ProjectAccess, kind: str | None = None) -> list[AssetRow]:
        if kind and kind not in all_asset_kinds():
            raise api_error(status.HTTP_422_UNPROCESSABLE_CONTENT, "asset_unknown_kind", "Unknown asset kind.")
        with connection() as conn:
            return asset_rows(repository.list_assets(conn, access.project_id, kind=kind))

    def patch_display_name(self, access: ProjectAccess, asset_id: str, display_name: str) -> AssetRow:
        require_editor_user(access)
        with transaction() as conn:
            try:
                return asset_row(repository.patch_asset_display_name(conn, access.project_id, asset_id, display_name))
            except LookupError as exc:
                raise asset_not_found() from exc

    def soft_delete(self, access: ProjectAccess, asset_id: str) -> None:
        """Soft-delete an asset row; R2 object cleanup is deferred to GC.

        Single transaction. Does NOT delete the R2 object — the
        ``sweep_orphaned_assets`` pass moves objects to the orphan
        prefix later, which gives us a recovery window if the soft
        delete was a mistake. Idempotent on missing/already-deleted
        rows (repository returns silently); callers needing a 404 must
        check ``get_asset`` first.
        """
        user = require_editor_user(access)
        with transaction() as conn:
            repository.soft_delete_asset(conn, access.project_id, asset_id, deleted_by=user.id)

    def get_asset_urls(
        self, access: ProjectAccess, asset_id: str, *, require_reference_for_anonymous: bool = True
    ) -> AssetUrlsResponse:
        asset = self.get_asset(access, asset_id)
        if asset.upload_status != "uploaded":
            raise api_error(status.HTTP_409_CONFLICT, "asset_upload_incomplete", "Asset upload is not complete.")
        if access.user is None and require_reference_for_anonymous and not self._asset_is_referenced(access, asset_id):
            raise api_error(
                status.HTTP_403_FORBIDDEN, "asset_not_referenced", "Asset is not referenced by this public view."
            )
        return self._urls_for_asset(asset)

    def bulk_urls(self, access: ProjectAccess, asset_ids: list[str]) -> list[AssetUrlsResponse]:
        if len(asset_ids) > 100:
            raise api_error(status.HTTP_400_BAD_REQUEST, "asset_bulk_overflow", "bulk-urls accepts at most 100 ids.")
        with connection() as conn:
            assets = asset_rows(repository.list_assets_by_ids(conn, access.project_id, asset_ids))
        if access.user is None:
            referenced = self._referenced_asset_ids_for_access(access)
            assets = [asset for asset in assets if asset.id in referenced]
        return [self._urls_for_asset(asset) for asset in assets if asset.upload_status == "uploaded"]

    def attach_asset(self, access: ProjectAccess, asset_id: str, payload) -> dict[str, object]:
        return self._mutate_attachment_array(access, asset_id, payload, mode="attach")

    def detach_asset(self, access: ProjectAccess, asset_id: str, payload) -> dict[str, object]:
        return self._mutate_attachment_array(access, asset_id, payload, mode="detach")

    def _validate_upload_intent_payload(self, payload: UploadIntentRequest) -> None:
        if payload.asset_kind not in all_asset_kinds():
            raise api_error(status.HTTP_422_UNPROCESSABLE_CONTENT, "asset_unknown_kind", "Unknown asset kind.")
        if payload.size_bytes > settings.asset_max_file_size_mb_hard_cap * 1024 * 1024:
            raise api_error(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "asset_size_exceeded", "Asset exceeds the hard size cap."
            )
        if payload.asset_kind == "hbjson":
            # Standalone kind-level policy (US-VIEW-1 / D-17): hbjson uploads
            # are not attachment-field-bound, so the field configs (and their
            # tighter caps) only apply later, at attach time.
            if not hbjson_upload_allowed(
                content_type=payload.content_type, original_filename=payload.original_filename
            ):
                raise api_error(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "asset_mime_not_allowed",
                    "Only .hbjson files are supported. Please drop a Honeybee Model JSON.",
                )
            return
        if payload.asset_kind in WEATHER_FILE_KINDS:
            if not weather_file_upload_allowed(
                asset_kind=payload.asset_kind,
                content_type=payload.content_type,
                original_filename=payload.original_filename,
                size_bytes=payload.size_bytes,
            ):
                raise api_error(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "asset_mime_not_allowed",
                    f"Only .{payload.asset_kind} weather files are supported.",
                )
            return
        if payload.asset_kind != "export_bundle":
            fields = attachment_fields_for_asset_kind(payload.asset_kind)
            if fields and not any(
                asset_matches_field(
                    field,
                    asset_kind=payload.asset_kind,
                    content_type=payload.content_type,
                    original_filename=payload.original_filename,
                    size_bytes=payload.size_bytes,
                )
                for field in fields
            ):
                raise api_error(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "asset_mime_not_allowed",
                    "File type is not allowed for this asset kind.",
                )

    def _validate_magic(self, asset: AssetRow, prefix: bytes) -> None:
        if asset.content_type == "application/pdf" and not prefix.startswith(b"%PDF"):
            raise ValueError("pdf_magic_mismatch")
        if asset.content_type == "image/png" and not prefix.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("png_magic_mismatch")
        if asset.content_type == "image/jpeg" and not prefix.startswith(b"\xff\xd8\xff"):
            raise ValueError("jpeg_magic_mismatch")
        if asset.content_type == "image/webp" and not (prefix[:4] == b"RIFF" and prefix[8:12] == b"WEBP"):
            raise ValueError("webp_magic_mismatch")
        if is_heic_content_type(asset.content_type) and not prefix_looks_like_heic(prefix):
            raise ValueError("heic_magic_mismatch")
        if (
            asset.content_type in {"application/json", "application/octet-stream"}
            and filename_extension(asset.original_filename) == ".hbjson"
        ):
            # `prefix` is only the first 8 KB — full json.loads is valid only
            # when the whole file fits in it; larger files get a JSON-object
            # sniff (real schema validation is the extraction job's problem).
            if len(prefix) >= asset.size_bytes:
                try:
                    json.loads(prefix.decode("utf-8"))
                except Exception as exc:
                    raise ValueError("hbjson_parse_failed") from exc
            elif not prefix.lstrip().startswith(b"{"):
                raise ValueError("hbjson_parse_failed")
        if asset.asset_kind == "epw" and not epw_header_looks_valid(prefix):
            raise ValueError("epw_location_header_missing")

    def _urls_for_asset(self, asset: AssetRow) -> AssetUrlsResponse:
        now = datetime.now(tz=UTC)
        download_ttl = settings.asset_signed_url_ttl_download_seconds
        preview_ttl = settings.asset_signed_url_ttl_preview_seconds
        disposition = f'attachment; filename="{_safe_header_filename(asset.original_filename)}"'
        thumbnail_key = asset.metadata.thumbnail_object_key
        return AssetUrlsResponse(
            asset_id=asset.id,
            preview_url=self.r2.generate_signed_get_url(asset.object_key, preview_ttl),
            preview_expires_at=now + timedelta(seconds=preview_ttl),
            download_url=self.r2.generate_signed_get_url(asset.object_key, download_ttl, disposition),
            download_expires_at=now + timedelta(seconds=download_ttl),
            thumbnail_url=self.r2.generate_signed_get_url(thumbnail_key, preview_ttl) if thumbnail_key else None,
            thumbnail_status=asset.metadata.thumbnail_status,
            thumbnail_expires_at=now + timedelta(seconds=preview_ttl) if thumbnail_key else None,
            content_type=asset.content_type,
            original_filename=asset.original_filename,
            display_name=asset.display_name,
            size_bytes=asset.size_bytes,
        )

    def _asset_is_referenced(self, access: ProjectAccess, asset_id: str) -> bool:
        if any(ref["asset_id"] == asset_id for ref in self._references_for_access(access)):
            return True
        with connection() as conn:
            return asset_id in self._location_asset_ids_for_project(conn, access.project_id)

    def _references_for_access(self, access: ProjectAccess) -> list[dict[str, object]]:
        version_id = access.project.active_version_id
        if version_id is None:
            return []
        body = get_saved_document(version_id, access)
        return list_asset_references(body)

    def _referenced_asset_ids_for_access(self, access: ProjectAccess) -> set[str]:
        asset_ids = {str(ref["asset_id"]) for ref in self._references_for_access(access)}
        with connection() as conn:
            asset_ids.update(self._location_asset_ids_for_project(conn, access.project_id))
        return asset_ids

    def _location_asset_ids_for_project(self, conn: Connection[Any], project_id: UUID) -> set[str]:
        return location_asset_ids_for_project(conn, project_id)

    def _mutate_attachment_array(
        self, access: ProjectAccess, asset_id: str, payload, *, mode: str
    ) -> dict[str, object]:
        user = require_editor_user(access)
        field = get_attachment_field(payload.table_key, payload.field_key)
        if field is None:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "asset_attachment_field_unknown", "Unknown attachment field."
            )
        with transaction() as conn:
            asset = asset_row_or_none(repository.get_asset_by_id(conn, access.project_id, asset_id))
            if asset is None:
                other = asset_row_or_none(repository.get_asset_by_id_any_project(conn, asset_id))
                if other is not None:
                    raise api_error(
                        status.HTTP_422_UNPROCESSABLE_CONTENT,
                        "asset_cross_project_reference",
                        "Asset belongs to another project.",
                    )
                raise asset_not_found()
            if asset.upload_status != "uploaded":
                raise api_error(status.HTTP_409_CONFLICT, "asset_upload_incomplete", "Asset upload is not complete.")
            if not asset_matches_field(
                field,
                asset_kind=asset.asset_kind,
                content_type=asset.content_type,
                original_filename=asset.original_filename,
                size_bytes=asset.size_bytes,
            ):
                raise api_error(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "asset_mime_not_allowed",
                    "Asset is not valid for this field.",
                )
            base_body, base_version_etag, version_etag, draft = load_draft_context(
                conn,
                access.project_id,
                UUID(payload.version_id),
                user.id,
                payload.if_match,
                payload.if_match_version,
                draft_etag_mismatch_message="The draft changed before this attachment update was applied.",
            )
            next_raw = base_body.model_dump(mode="json")
            row = find_row(next_raw, payload.table_key, payload.row_id)
            values = row.get(payload.field_key)
            if not isinstance(values, list):
                values = []
            values = [str(value) for value in values if isinstance(value, str)]
            if mode == "attach":
                if asset_id not in values:
                    if len(values) >= field.max_count:
                        raise api_error(
                            status.HTTP_422_UNPROCESSABLE_CONTENT, "asset_count_exceeded", "Attachment cell is full."
                        )
                    insert_at = payload.index if payload.index is not None else len(values)
                    values.insert(max(0, min(insert_at, len(values))), asset_id)
            else:
                values = [value for value in values if value != asset_id]
            row[payload.field_key] = values
            if mode == "attach" and payload.field_key in ATTACHMENT_STATUS_FIELD_BY_ASSET_FIELD:
                row[ATTACHMENT_STATUS_FIELD_BY_ASSET_FIELD[payload.field_key]] = "complete"
            next_body = validate_document(next_raw)
            serialized_next = enforce_document_body_size(next_body)
            draft_etag = next_draft_etag_from_etag(serialized_next.etag)

            document_repository.upsert_draft(
                conn,
                UUID(payload.version_id),
                user.id,
                next_body,
                base_version_etag,
                draft_etag,
                serialized_body=serialized_next,
            )
        return {
            "version_etag": version_etag,
            "draft_etag": draft_etag,
            "source": "draft" if draft else "version",
            "asset_ids": values,
        }


def _extension_from_content_type(content_type: str) -> str:
    return {
        "application/pdf": "pdf",
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/heic": "heic",
        "image/heif": "heif",
        "application/zip": "zip",
        "application/json": "hbjson",
    }.get(content_type, "bin")


def _safe_header_filename(filename: str) -> str:
    return filename.replace('"', "'").replace("\r", "").replace("\n", "")
