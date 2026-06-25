"""Bulk-download workflow for asset exports."""

from __future__ import annotations

import csv
import hashlib
import io
import re
import zipfile
from typing import cast
from uuid import UUID

from starlette import status

from database import connection, transaction
from features.assets import repository
from features.assets.base import AssetStorage, generated_asset_id, generated_job_id
from features.assets.mapping import asset_rows, job_response, job_response_or_none
from features.assets.models import AssetRow, BulkDownloadFilter, BulkDownloadRequest, JobResponse
from features.assets.registry import iter_rows_for_raw_tables, list_asset_references
from features.assets.storage_r2 import asset_object_key
from features.project_document.store import get_saved_document
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error


class AssetBulkDownloadWorkflow:
    r2: AssetStorage

    def start_bulk_download(self, access: ProjectAccess, payload: BulkDownloadRequest) -> JobResponse:
        """Run a bulk-download job synchronously, exposing job-style status."""

        user = require_editor_user(access)
        job_id = generated_job_id()
        with transaction() as conn:
            repository.insert_job(
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
                job = job_response(
                    repository.update_job(
                        conn,
                        project_id=access.project_id,
                        job_id=job_id,
                        status="completed",
                        progress=100,
                        result_asset_id=result_asset_id,
                    )
                )
        except Exception as exc:
            with transaction() as conn:
                job = job_response(
                    repository.update_job(
                        conn,
                        project_id=access.project_id,
                        job_id=job_id,
                        status="failed",
                        progress=100,
                        error_code="asset_bulk_download_failed",
                        error_details={"message": str(exc)},
                    )
                )
        return job.model_copy(update={"status_url": f"/api/v1/projects/{access.project_id}/jobs/{job.id}"})

    def get_job(self, access: ProjectAccess, job_id: str) -> JobResponse:
        with connection() as conn:
            job = job_response_or_none(repository.get_job(conn, access.project_id, job_id))
        if job is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "job_not_found", "Job not found.")
        return job.model_copy(update={"status_url": f"/api/v1/projects/{access.project_id}/jobs/{job.id}"})

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
            assets = {
                asset.id: asset
                for asset in asset_rows(repository.list_assets_by_ids(conn, access.project_id, ordered_ids))
            }
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
            repository.insert_pending_asset(
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
            repository.mark_asset_uploaded(conn, access.project_id, asset_id, r2_etag="")
        return asset_id


def find_row(document: dict[str, object], table_key: str, row_id: str) -> dict[str, object]:
    tables = cast(dict[str, object], document["tables"])
    if not isinstance(tables, dict):
        raise ValueError("invalid_tables")
    if table_key == "assembly_segments":
        for assembly in dict_rows(tables.get("assemblies")):
            for layer in dict_rows(assembly.get("layers")):
                for segment in dict_rows(layer.get("segments")):
                    if segment.get("id") == row_id:
                        return segment
        rows = []
    else:
        rows = iter_rows_for_raw_tables(tables, table_key)
    for row in rows:
        if row.get("id") == row_id:
            return row
    raise api_error(status.HTTP_404_NOT_FOUND, "document_row_not_found", "Document row not found.")


def dict_rows(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


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
