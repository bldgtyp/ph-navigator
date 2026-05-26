"""Raw SQL persistence for project assets and asset jobs."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb

from features.assets.schemas import AssetRow, JobResponse

ASSET_COLUMNS = """
id, project_id::text, asset_kind, object_key, original_filename, display_name,
content_type, size_bytes, content_hash_sha256, r2_etag, upload_status,
created_at, created_by::text, uploaded_at, deleted_at, deleted_by::text, metadata
"""

JOB_COLUMNS = """
id, project_id::text, job_type, status, progress, created_by::text, created_at,
started_at, finished_at, result_asset_id, error_code, error_details, metadata
"""


def insert_pending_asset(
    conn: Connection[Any],
    *,
    asset_id: str,
    project_id: UUID,
    asset_kind: str,
    object_key: str,
    original_filename: str,
    display_name: str,
    content_type: str,
    size_bytes: int,
    content_hash_sha256: str,
    created_by: UUID,
) -> AssetRow:
    row = conn.execute(
        f"""
        INSERT INTO project_assets (
            id, project_id, asset_kind, object_key, original_filename, display_name,
            content_type, size_bytes, content_hash_sha256, created_by, metadata
        )
        VALUES (
            %(asset_id)s, %(project_id)s, %(asset_kind)s, %(object_key)s,
            %(original_filename)s, %(display_name)s, %(content_type)s,
            %(size_bytes)s, %(content_hash_sha256)s, %(created_by)s,
            '{{"thumbnail_status": "pending"}}'::jsonb
        )
        RETURNING {ASSET_COLUMNS}
        """,
        {
            "asset_id": asset_id,
            "project_id": project_id,
            "asset_kind": asset_kind,
            "object_key": object_key,
            "original_filename": original_filename,
            "display_name": display_name,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "content_hash_sha256": content_hash_sha256.lower(),
            "created_by": created_by,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Asset insert did not return a row.")
    return AssetRow.model_validate(row)


def find_asset_by_content_hash(conn: Connection[Any], project_id: UUID, content_hash_sha256: str) -> AssetRow | None:
    row = conn.execute(
        f"""
        SELECT {ASSET_COLUMNS}
        FROM project_assets
        WHERE project_id = %(project_id)s
          AND content_hash_sha256 = %(content_hash_sha256)s
          AND deleted_at IS NULL
        ORDER BY created_at ASC
        LIMIT 1
        """,
        {"project_id": project_id, "content_hash_sha256": content_hash_sha256.lower()},
    ).fetchone()
    return AssetRow.model_validate(row) if row else None


def get_asset_by_id(
    conn: Connection[Any], project_id: UUID, asset_id: str, *, include_deleted: bool = False
) -> AssetRow | None:
    deleted_clause = "" if include_deleted else "AND deleted_at IS NULL"
    row = conn.execute(
        f"""
        SELECT {ASSET_COLUMNS}
        FROM project_assets
        WHERE project_id = %(project_id)s
          AND id = %(asset_id)s
          {deleted_clause}
        """,
        {"project_id": project_id, "asset_id": asset_id},
    ).fetchone()
    return AssetRow.model_validate(row) if row else None


def get_asset_by_id_any_project(conn: Connection[Any], asset_id: str) -> AssetRow | None:
    row = conn.execute(
        f"""
        SELECT {ASSET_COLUMNS}
        FROM project_assets
        WHERE id = %(asset_id)s
          AND deleted_at IS NULL
        """,
        {"asset_id": asset_id},
    ).fetchone()
    return AssetRow.model_validate(row) if row else None


def list_assets(conn: Connection[Any], project_id: UUID, *, kind: str | None = None) -> list[AssetRow]:
    kind_clause = "AND asset_kind = %(kind)s" if kind else ""
    rows = conn.execute(
        f"""
        SELECT {ASSET_COLUMNS}
        FROM project_assets
        WHERE project_id = %(project_id)s
          AND deleted_at IS NULL
          {kind_clause}
        ORDER BY created_at DESC
        """,
        {"project_id": project_id, "kind": kind},
    ).fetchall()
    return [AssetRow.model_validate(row) for row in rows]


def list_asset_gc_candidates(
    conn: Connection[Any],
    project_id: UUID,
    *,
    pending_expired_before: datetime,
) -> list[AssetRow]:
    rows = conn.execute(
        f"""
        SELECT {ASSET_COLUMNS}
        FROM project_assets
        WHERE project_id = %(project_id)s
          AND COALESCE(metadata ->> 'orphaned_status', '') <> 'moved'
          AND (
            deleted_at IS NOT NULL
            OR upload_status = 'failed'
            OR (upload_status = 'pending' AND created_at < %(pending_expired_before)s)
            OR upload_status = 'uploaded'
          )
        ORDER BY created_at ASC
        """,
        {"project_id": project_id, "pending_expired_before": pending_expired_before},
    ).fetchall()
    return [AssetRow.model_validate(row) for row in rows]


def list_assets_by_ids(conn: Connection[Any], project_id: UUID, asset_ids: list[str]) -> list[AssetRow]:
    if not asset_ids:
        return []
    rows = conn.execute(
        f"""
        SELECT {ASSET_COLUMNS}
        FROM project_assets
        WHERE project_id = %(project_id)s
          AND id = ANY(%(asset_ids)s)
          AND deleted_at IS NULL
        """,
        {"project_id": project_id, "asset_ids": asset_ids},
    ).fetchall()
    by_id = {row["id"]: AssetRow.model_validate(row) for row in rows}
    return [by_id[asset_id] for asset_id in asset_ids if asset_id in by_id]


def mark_asset_uploaded(conn: Connection[Any], project_id: UUID, asset_id: str, *, r2_etag: str) -> AssetRow:
    row = conn.execute(
        f"""
        UPDATE project_assets
        SET upload_status = 'uploaded',
            r2_etag = %(r2_etag)s,
            uploaded_at = now()
        WHERE project_id = %(project_id)s
          AND id = %(asset_id)s
          AND deleted_at IS NULL
        RETURNING {ASSET_COLUMNS}
        """,
        {"project_id": project_id, "asset_id": asset_id, "r2_etag": r2_etag},
    ).fetchone()
    if row is None:
        raise LookupError("asset_not_found")
    return AssetRow.model_validate(row)


def mark_asset_failed(conn: Connection[Any], project_id: UUID, asset_id: str, *, reason: str) -> AssetRow:
    row = conn.execute(
        f"""
        UPDATE project_assets
        SET upload_status = 'failed',
            metadata = metadata || %(patch)s::jsonb
        WHERE project_id = %(project_id)s
          AND id = %(asset_id)s
          AND deleted_at IS NULL
        RETURNING {ASSET_COLUMNS}
        """,
        {"project_id": project_id, "asset_id": asset_id, "patch": Jsonb({"failure_reason": reason})},
    ).fetchone()
    if row is None:
        raise LookupError("asset_not_found")
    return AssetRow.model_validate(row)


def set_asset_metadata(
    conn: Connection[Any], project_id: UUID, asset_id: str, metadata_patch: dict[str, Any]
) -> AssetRow:
    row = conn.execute(
        f"""
        UPDATE project_assets
        SET metadata = metadata || %(patch)s::jsonb
        WHERE project_id = %(project_id)s
          AND id = %(asset_id)s
          AND deleted_at IS NULL
        RETURNING {ASSET_COLUMNS}
        """,
        {"project_id": project_id, "asset_id": asset_id, "patch": Jsonb(metadata_patch)},
    ).fetchone()
    if row is None:
        raise LookupError("asset_not_found")
    return AssetRow.model_validate(row)


def patch_asset_display_name(conn: Connection[Any], project_id: UUID, asset_id: str, display_name: str) -> AssetRow:
    row = conn.execute(
        f"""
        UPDATE project_assets
        SET display_name = %(display_name)s
        WHERE project_id = %(project_id)s
          AND id = %(asset_id)s
          AND deleted_at IS NULL
        RETURNING {ASSET_COLUMNS}
        """,
        {"project_id": project_id, "asset_id": asset_id, "display_name": display_name},
    ).fetchone()
    if row is None:
        raise LookupError("asset_not_found")
    return AssetRow.model_validate(row)


def soft_delete_asset(conn: Connection[Any], project_id: UUID, asset_id: str, *, deleted_by: UUID) -> None:
    conn.execute(
        """
        UPDATE project_assets
        SET deleted_at = COALESCE(deleted_at, now()),
            deleted_by = COALESCE(deleted_by, %(deleted_by)s)
        WHERE project_id = %(project_id)s
          AND id = %(asset_id)s
        """,
        {"project_id": project_id, "asset_id": asset_id, "deleted_by": deleted_by},
    )


def mark_asset_orphaned(
    conn: Connection[Any],
    project_id: UUID,
    asset_id: str,
    *,
    object_key: str,
    metadata_patch: dict[str, Any],
) -> AssetRow:
    row = conn.execute(
        f"""
        UPDATE project_assets
        SET object_key = %(object_key)s,
            metadata = metadata || %(metadata_patch)s::jsonb
        WHERE project_id = %(project_id)s
          AND id = %(asset_id)s
        RETURNING {ASSET_COLUMNS}
        """,
        {
            "project_id": project_id,
            "asset_id": asset_id,
            "object_key": object_key,
            "metadata_patch": Jsonb(metadata_patch),
        },
    ).fetchone()
    if row is None:
        raise LookupError("asset_not_found")
    return AssetRow.model_validate(row)


def insert_job(
    conn: Connection[Any], *, job_id: str, project_id: UUID, created_by: UUID, metadata: dict[str, Any]
) -> JobResponse:
    row = conn.execute(
        f"""
        INSERT INTO project_jobs (id, project_id, job_type, created_by, metadata)
        VALUES (%(job_id)s, %(project_id)s, 'asset_bulk_download', %(created_by)s, %(metadata)s)
        RETURNING {JOB_COLUMNS}
        """,
        {"job_id": job_id, "project_id": project_id, "created_by": created_by, "metadata": Jsonb(metadata)},
    ).fetchone()
    if row is None:
        raise RuntimeError("Job insert did not return a row.")
    return JobResponse.model_validate(row)


def update_job(
    conn: Connection[Any],
    *,
    project_id: UUID,
    job_id: str,
    status: str,
    progress: int,
    result_asset_id: str | None = None,
    error_code: str | None = None,
    error_details: dict[str, Any] | None = None,
) -> JobResponse:
    row = conn.execute(
        f"""
        UPDATE project_jobs
        SET status = %(status)s,
            progress = %(progress)s,
            started_at = COALESCE(started_at, now()),
            finished_at = CASE WHEN %(status)s IN ('completed', 'failed') THEN now() ELSE finished_at END,
            result_asset_id = %(result_asset_id)s,
            error_code = %(error_code)s,
            error_details = %(error_details)s
        WHERE project_id = %(project_id)s
          AND id = %(job_id)s
        RETURNING {JOB_COLUMNS}
        """,
        {
            "project_id": project_id,
            "job_id": job_id,
            "status": status,
            "progress": progress,
            "result_asset_id": result_asset_id,
            "error_code": error_code,
            "error_details": Jsonb(error_details or {}),
        },
    ).fetchone()
    if row is None:
        raise LookupError("job_not_found")
    return JobResponse.model_validate(row)


def get_job(conn: Connection[Any], project_id: UUID, job_id: str) -> JobResponse | None:
    row = conn.execute(
        f"""
        SELECT {JOB_COLUMNS}
        FROM project_jobs
        WHERE project_id = %(project_id)s
          AND id = %(job_id)s
        """,
        {"project_id": project_id, "job_id": job_id},
    ).fetchone()
    return JobResponse.model_validate(row) if row else None
