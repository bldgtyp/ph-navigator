"""Asset workflow service: upload intents, completion, URLs, draft attachment, and bulk jobs."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import zipfile
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol, cast
from uuid import UUID

from fastapi import BackgroundTasks
from psycopg import Connection
from starlette import status

from config import settings
from database import connection, transaction
from features.assets import repository
from features.assets.registry import (
    all_asset_kinds,
    asset_matches_field,
    attachment_fields_for_asset_kind,
    filename_extension,
    get_attachment_field,
    list_asset_references,
)
from features.assets.schemas import (
    AssetRow,
    AssetUrlsResponse,
    BulkDownloadFilter,
    BulkDownloadRequest,
    BulkUploadIntentItem,
    BulkUploadIntentResponse,
    JobResponse,
    UploadIntentRequest,
    UploadIntentResponse,
)
from features.assets.storage_r2 import asset_object_key, orphaned_asset_object_key
from features.project_document.drafts import _load_draft_context
from features.project_document.store import get_saved_document
from features.project_document.validation import next_draft_etag, validate_document
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error


def generated_asset_id() -> str:
    return f"asset_{datetime.now(tz=UTC).strftime('%Y%m%d%H%M%S%f')}"


def generated_job_id() -> str:
    return f"job_{datetime.now(tz=UTC).strftime('%Y%m%d%H%M%S%f')}"


class AssetStorage(Protocol):
    def generate_signed_put_url(
        self,
        object_key: str,
        content_type: str,
        size_bytes: int,
        expires_in_seconds: int = 600,
    ) -> str: ...

    def generate_signed_get_url(
        self,
        object_key: str,
        expires_in_seconds: int,
        response_content_disposition: str | None = None,
    ) -> str: ...

    def head_object(self, object_key: str) -> dict[str, object]: ...

    def get_object_prefix(self, object_key: str, byte_range: tuple[int, int]) -> bytes: ...

    def get_object(self, object_key: str) -> bytes: ...

    def put_object(self, object_key: str, body: bytes, content_type: str) -> str: ...

    def copy_object(self, source_key: str, dest_key: str) -> None: ...

    def delete_object(self, object_key: str) -> None: ...


class AssetThumbnailer(Protocol):
    def render_for_asset(self, project_id: UUID, asset_id: str) -> None: ...


class AssetService:
    def __init__(self, r2: AssetStorage, thumbnailer: AssetThumbnailer):
        self.r2 = r2
        self.thumbnailer = thumbnailer

    def create_upload_intent(self, access: ProjectAccess, payload: UploadIntentRequest) -> UploadIntentResponse:
        user = require_editor_user(access)
        self._validate_upload_intent_payload(payload)
        ext = filename_extension(payload.original_filename).lstrip(".") or _extension_from_content_type(
            payload.content_type
        )
        asset_id = generated_asset_id()
        object_key = asset_object_key(access.project_id, asset_id, ext)
        with transaction() as conn:
            duplicate = repository.find_asset_by_content_hash(conn, access.project_id, payload.content_hash_sha256)
            if duplicate is not None:
                return UploadIntentResponse(
                    asset=duplicate, upload_url=None, expires_at=None, duplicate_of=duplicate.id
                )
            asset = repository.insert_pending_asset(
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
        expires_at = datetime.now(tz=UTC) + timedelta(minutes=10)
        return UploadIntentResponse(
            asset=asset,
            upload_url=self.r2.generate_signed_put_url(object_key, payload.content_type, payload.size_bytes),
            expires_at=expires_at,
        )

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
        require_editor_user(access)
        with connection() as conn:
            asset = repository.get_asset_by_id(conn, access.project_id, asset_id)
        if asset is None:
            raise _asset_not_found()
        try:
            head = self.r2.head_object(asset.object_key)
            size = int(cast(int | str, head.get("ContentLength", -1)))
            if size != asset.size_bytes:
                raise ValueError("size_mismatch")
            prefix = self.r2.get_object_prefix(asset.object_key, (0, min(asset.size_bytes, 8191)))
            self._validate_magic(asset, prefix)
        except Exception as exc:
            with transaction() as conn:
                repository.mark_asset_failed(conn, access.project_id, asset_id, reason=str(exc))
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "asset_mime_not_allowed",
                "Uploaded file does not match the declared content type or policy.",
                {"asset_id": asset_id, "reason": str(exc)},
            ) from exc

        with transaction() as conn:
            uploaded = repository.mark_asset_uploaded(
                conn,
                access.project_id,
                asset_id,
                r2_etag=str(head.get("ETag", "")).strip('"'),
            )
        background_tasks.add_task(self.thumbnailer.render_for_asset, access.project_id, asset_id)
        return uploaded

    def get_asset(self, access: ProjectAccess, asset_id: str) -> AssetRow:
        with connection() as conn:
            asset = repository.get_asset_by_id(conn, access.project_id, asset_id)
        if asset is None:
            raise _asset_not_found()
        return asset

    def list_assets(self, access: ProjectAccess, kind: str | None = None) -> list[AssetRow]:
        if kind and kind not in all_asset_kinds():
            raise api_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "asset_unknown_kind", "Unknown asset kind.")
        with connection() as conn:
            return repository.list_assets(conn, access.project_id, kind=kind)

    def patch_display_name(self, access: ProjectAccess, asset_id: str, display_name: str) -> AssetRow:
        require_editor_user(access)
        with transaction() as conn:
            try:
                return repository.patch_asset_display_name(conn, access.project_id, asset_id, display_name)
            except LookupError as exc:
                raise _asset_not_found() from exc

    def soft_delete(self, access: ProjectAccess, asset_id: str) -> None:
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
            assets = repository.list_assets_by_ids(conn, access.project_id, asset_ids)
        if access.user is None:
            referenced = {ref["asset_id"] for ref in self._references_for_access(access)}
            assets = [asset for asset in assets if asset.id in referenced]
        return [self._urls_for_asset(asset) for asset in assets if asset.upload_status == "uploaded"]

    def attach_asset(self, access: ProjectAccess, asset_id: str, payload) -> dict[str, object]:
        return self._mutate_attachment_array(access, asset_id, payload, mode="attach")

    def detach_asset(self, access: ProjectAccess, asset_id: str, payload) -> dict[str, object]:
        return self._mutate_attachment_array(access, asset_id, payload, mode="detach")

    def start_bulk_download(self, access: ProjectAccess, payload: BulkDownloadRequest) -> JobResponse:
        user = require_editor_user(access)
        job_id = generated_job_id()
        with transaction() as conn:
            job = repository.insert_job(
                conn,
                job_id=job_id,
                project_id=access.project_id,
                created_by=user.id,
                metadata=payload.model_dump(mode="json"),
            )
        try:
            result_asset_id = self._run_bulk_download(
                access, payload.filter, payload.filename_pattern, payload.include_manifest_csv, user.id
            )
            with transaction() as conn:
                job = repository.update_job(
                    conn,
                    project_id=access.project_id,
                    job_id=job_id,
                    status="completed",
                    progress=100,
                    result_asset_id=result_asset_id,
                )
        except Exception as exc:
            with transaction() as conn:
                job = repository.update_job(
                    conn,
                    project_id=access.project_id,
                    job_id=job_id,
                    status="failed",
                    progress=100,
                    error_code="asset_bulk_download_failed",
                    error_details={"message": str(exc)},
                )
        return job.model_copy(update={"status_url": f"/api/v1/projects/{access.project_id}/jobs/{job.id}"})

    def get_job(self, access: ProjectAccess, job_id: str) -> JobResponse:
        with connection() as conn:
            job = repository.get_job(conn, access.project_id, job_id)
        if job is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "job_not_found", "Job not found.")
        return job.model_copy(update={"status_url": f"/api/v1/projects/{access.project_id}/jobs/{job.id}"})

    def sweep_orphaned_assets(
        self,
        project_id: UUID,
        *,
        dry_run: bool = True,
        pending_max_age_hours: int = 24,
    ) -> dict[str, object]:
        pending_expired_before = datetime.now(tz=UTC) - timedelta(hours=pending_max_age_hours)
        with connection() as conn:
            candidates = repository.list_asset_gc_candidates(
                conn,
                project_id,
                pending_expired_before=pending_expired_before,
            )
            referenced_ids = self._referenced_asset_ids_for_project(conn, project_id)

        results: list[dict[str, object]] = []
        errors: list[dict[str, object]] = []
        for asset in candidates:
            if asset.id in referenced_ids:
                continue
            reason = _gc_reason(asset, pending_expired_before)
            if reason is None:
                continue
            target_key = orphaned_asset_object_key(project_id, asset.id, asset.object_key)
            result: dict[str, object] = {
                "asset_id": asset.id,
                "reason": reason,
                "from": asset.object_key,
                "to": target_key,
            }
            if dry_run:
                results.append(result)
                continue
            try:
                moved_thumbnail_key = self._move_asset_object_to_orphan_prefix(asset, target_key)
                metadata_patch: dict[str, object] = {
                    "orphaned_status": "moved",
                    "orphaned_at": datetime.now(tz=UTC).isoformat(),
                    "orphaned_reason": reason,
                    "original_object_key": asset.object_key,
                }
                if moved_thumbnail_key:
                    metadata_patch["thumbnail_object_key"] = moved_thumbnail_key
                with transaction() as conn:
                    repository.mark_asset_orphaned(
                        conn,
                        project_id,
                        asset.id,
                        object_key=target_key,
                        metadata_patch=metadata_patch,
                    )
                results.append(result)
            except Exception as exc:
                errors.append({"asset_id": asset.id, "reason": reason, "error": str(exc)})
        return {"dry_run": dry_run, "moved": results, "errors": errors}

    def _validate_upload_intent_payload(self, payload: UploadIntentRequest) -> None:
        if payload.asset_kind not in all_asset_kinds():
            raise api_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "asset_unknown_kind", "Unknown asset kind.")
        if payload.size_bytes > settings.asset_max_file_size_mb_hard_cap * 1024 * 1024:
            raise api_error(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "asset_size_exceeded", "Asset exceeds the hard size cap."
            )
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
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
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
        if (
            asset.content_type in {"application/json", "application/octet-stream"}
            and filename_extension(asset.original_filename) == ".hbjson"
        ):
            try:
                json.loads(prefix.decode("utf-8"))
            except Exception as exc:
                raise ValueError("hbjson_parse_failed") from exc

    def _urls_for_asset(self, asset: AssetRow) -> AssetUrlsResponse:
        now = datetime.now(tz=UTC)
        download_ttl = settings.asset_signed_url_ttl_download_seconds
        preview_ttl = settings.asset_signed_url_ttl_preview_seconds
        disposition = f'attachment; filename="{_safe_header_filename(asset.original_filename)}"'
        thumbnail_key = asset.metadata.thumbnail_object_key
        return AssetUrlsResponse(
            asset_id=asset.id,
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
        return any(ref["asset_id"] == asset_id for ref in self._references_for_access(access))

    def _references_for_access(self, access: ProjectAccess) -> list[dict[str, object]]:
        version_id = access.project.active_version_id
        if version_id is None:
            return []
        body = get_saved_document(version_id, access)
        return list_asset_references(body)

    def _referenced_asset_ids_for_project(self, conn: Connection[Any], project_id: UUID) -> set[str]:
        rows = conn.execute(
            """
            SELECT body
            FROM project_versions
            WHERE project_id = %(project_id)s
            UNION ALL
            SELECT d.body
            FROM project_version_drafts d
            JOIN project_versions v ON v.id = d.version_id
            WHERE v.project_id = %(project_id)s
            """,
            {"project_id": project_id},
        ).fetchall()
        referenced: set[str] = set()
        for row in rows:
            body = validate_document(row["body"])
            referenced.update(str(ref["asset_id"]) for ref in list_asset_references(body))
        return referenced

    def _move_asset_object_to_orphan_prefix(self, asset: AssetRow, target_key: str) -> str | None:
        self.r2.copy_object(asset.object_key, target_key)
        self.r2.delete_object(asset.object_key)
        thumbnail_key = asset.metadata.thumbnail_object_key
        if not thumbnail_key:
            return None
        target_thumbnail_key = target_key.rsplit("/", maxsplit=1)[0] + "/thumb.png"
        self.r2.copy_object(thumbnail_key, target_thumbnail_key)
        self.r2.delete_object(thumbnail_key)
        return target_thumbnail_key

    def _mutate_attachment_array(
        self, access: ProjectAccess, asset_id: str, payload, *, mode: str
    ) -> dict[str, object]:
        user = require_editor_user(access)
        field = get_attachment_field(payload.table_key, payload.field_key)
        if field is None:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "asset_attachment_field_unknown", "Unknown attachment field."
            )
        with transaction() as conn:
            asset = repository.get_asset_by_id(conn, access.project_id, asset_id)
            if asset is None:
                other = repository.get_asset_by_id_any_project(conn, asset_id)
                if other is not None:
                    raise api_error(
                        status.HTTP_422_UNPROCESSABLE_ENTITY,
                        "asset_cross_project_reference",
                        "Asset belongs to another project.",
                    )
                raise _asset_not_found()
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
                    status.HTTP_422_UNPROCESSABLE_ENTITY, "asset_mime_not_allowed", "Asset is not valid for this field."
                )
            base_body, base_version_etag, version_etag, draft = _load_draft_context(
                conn,
                access.project_id,
                UUID(payload.version_id),
                user.id,
                payload.if_match,
                payload.if_match_version,
                draft_etag_mismatch_message="The draft changed before this attachment update was applied.",
            )
            next_raw = base_body.model_dump(mode="json")
            row = _find_row(next_raw, payload.table_key, payload.row_id)
            values = row.get(payload.field_key)
            if not isinstance(values, list):
                values = []
            values = [str(value) for value in values if isinstance(value, str)]
            if mode == "attach":
                if asset_id not in values:
                    if len(values) >= field.max_count:
                        raise api_error(
                            status.HTTP_422_UNPROCESSABLE_ENTITY, "asset_count_exceeded", "Attachment cell is full."
                        )
                    insert_at = payload.index if payload.index is not None else len(values)
                    values.insert(max(0, min(insert_at, len(values))), asset_id)
            else:
                values = [value for value in values if value != asset_id]
            row[payload.field_key] = values
            next_body = validate_document(next_raw)
            draft_etag = next_draft_etag(next_body)
            from features.project_document import repository as document_repository

            document_repository.upsert_draft(
                conn, UUID(payload.version_id), user.id, next_body, base_version_etag, draft_etag
            )
        return {
            "version_etag": version_etag,
            "draft_etag": draft_etag,
            "source": "draft" if draft else "version",
            "asset_ids": values,
        }

    def _run_bulk_download(
        self,
        access: ProjectAccess,
        filter_: BulkDownloadFilter,
        filename_pattern: str,
        include_manifest_csv: bool,
        created_by: UUID,
    ) -> str:
        version_id = access.project.active_version_id
        if version_id is None:
            raise ValueError("No active version.")
        body = get_saved_document(version_id, access)
        asset_ids = set(filter_.asset_ids or [])
        references = list_asset_references(
            body,
            asset_ids=asset_ids or None,
            table_key=filter_.table_key,
            column_key=filter_.column_key,
            kind=filter_.kind,
        )
        if not references:
            raise ValueError("No matching assets.")
        ordered_ids = [str(ref["asset_id"]) for ref in references]
        with connection() as conn:
            assets = {asset.id: asset for asset in repository.list_assets_by_ids(conn, access.project_id, ordered_ids)}
        zip_buffer = io.BytesIO()
        manifest_rows: list[dict[str, object]] = []
        used_paths: set[str] = set()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for ref in references:
                asset = assets.get(str(ref["asset_id"]))
                if asset is None or asset.upload_status != "uploaded":
                    continue
                path = _dedupe_path(
                    _render_filename_pattern(filename_pattern, ref, asset),
                    used_paths,
                )
                used_paths.add(path)
                zf.writestr(path, self.r2.get_object(asset.object_key))
                manifest_rows.append(
                    {
                        **ref,
                        "original_filename": asset.original_filename,
                        "content_type": asset.content_type,
                        "size_bytes": asset.size_bytes,
                        "zip_path": path,
                    }
                )
            if include_manifest_csv:
                manifest = io.StringIO()
                writer = csv.DictWriter(
                    manifest,
                    fieldnames=[
                        "table_key",
                        "row_id",
                        "row_name",
                        "field_key",
                        "asset_id",
                        "index",
                        "original_filename",
                        "content_type",
                        "size_bytes",
                        "zip_path",
                    ],
                )
                writer.writeheader()
                writer.writerows(manifest_rows)
                zf.writestr("MANIFEST.csv", manifest.getvalue())

        digest = hashlib.sha256(zip_buffer.getvalue()).hexdigest()
        asset_id = generated_asset_id()
        object_key = asset_object_key(access.project_id, asset_id, "zip")
        self.r2.put_object(object_key, zip_buffer.getvalue(), "application/zip")
        with transaction() as conn:
            asset = repository.insert_pending_asset(
                conn,
                asset_id=asset_id,
                project_id=access.project_id,
                asset_kind="export_bundle",
                object_key=object_key,
                original_filename="attachments.zip",
                display_name="Attachments export",
                content_type="application/zip",
                size_bytes=len(zip_buffer.getvalue()),
                content_hash_sha256=digest,
                created_by=created_by,
            )
            repository.mark_asset_uploaded(conn, access.project_id, asset.id, r2_etag="")
        return asset_id


def _find_row(document: dict[str, object], table_key: str, row_id: str) -> dict[str, object]:
    tables = cast(dict[str, object], document["tables"])
    if not isinstance(tables, dict):
        raise ValueError("invalid_tables")
    rows: list[dict[str, object]]
    if table_key == "project_materials":
        rows = _dict_rows(tables.get("project_materials"))
    elif table_key == "thermal_bridges":
        rows = _dict_rows(tables.get("thermal_bridges"))
    elif table_key.startswith("equipment_"):
        equipment = tables.get("equipment")
        suffix = table_key.removeprefix("equipment_")
        equipment_rows = cast(dict[str, object], equipment) if isinstance(equipment, dict) else {}
        rows = _dict_rows(equipment_rows.get(suffix))
    elif table_key == "assembly_segments":
        for assembly in _dict_rows(tables.get("assemblies")):
            for layer in _dict_rows(assembly.get("layers")):
                for segment in _dict_rows(layer.get("segments")):
                    if segment.get("id") == row_id:
                        return segment
        rows = []
    else:
        rows = []
    for row in rows:
        if row.get("id") == row_id:
            return row
    raise api_error(status.HTTP_404_NOT_FOUND, "document_row_not_found", "Document row not found.")


def _dict_rows(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def _asset_not_found():
    return api_error(status.HTTP_404_NOT_FOUND, "asset_not_found", "Asset not found.")


def _gc_reason(asset: AssetRow, pending_expired_before: datetime) -> str | None:
    if asset.object_key.startswith(f"projects/{asset.project_id}/assets/_orphaned/"):
        return None
    if asset.deleted_at is not None:
        return "soft_deleted"
    if asset.upload_status == "failed":
        return "failed_upload"
    if asset.upload_status == "pending" and asset.created_at < pending_expired_before:
        return "expired_pending_upload"
    if asset.upload_status == "uploaded":
        return "unreferenced_upload"
    return None


def _extension_from_content_type(content_type: str) -> str:
    return {
        "application/pdf": "pdf",
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "application/zip": "zip",
        "application/json": "hbjson",
    }.get(content_type, "bin")


def _safe_header_filename(filename: str) -> str:
    return filename.replace('"', "'").replace("\r", "").replace("\n", "")


def _sanitize_path_part(value: object) -> str:
    text = str(value or "unnamed").strip()
    text = re.sub(r"[\\/]+", "-", text)
    text = re.sub(r"[^A-Za-z0-9._ -]+", "", text)
    return text or "unnamed"


def _render_filename_pattern(pattern: str, ref: dict[str, object], asset: AssetRow) -> str:
    return (
        pattern.replace("{table}", _sanitize_path_part(ref.get("table_key")))
        .replace("{row.name}", _sanitize_path_part(ref.get("row_name")))
        .replace("{field}", _sanitize_path_part(ref.get("field_key")))
        .replace("{filename}", _sanitize_path_part(asset.original_filename))
    )


def _dedupe_path(path: str, used: set[str]) -> str:
    clean = "/".join(_sanitize_path_part(part) for part in path.split("/") if part not in {"", ".", ".."})
    if clean not in used:
        return clean
    stem, dot, suffix = clean.rpartition(".")
    base = stem if dot else clean
    ext = f".{suffix}" if dot else ""
    index = 2
    while f"{base} ({index}){ext}" in used:
        index += 1
    return f"{base} ({index}){ext}"
