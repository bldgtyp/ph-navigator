"""Test builders for project asset rows."""

from __future__ import annotations

import hashlib
from typing import Any

from database import transaction


def insert_project_asset(
    *,
    project_id: object,
    asset_id: str,
    asset_kind: str = "datasheet",
    content_type: str = "application/pdf",
    original_filename: str = "datasheet.pdf",
    size_bytes: int = 32,
    upload_status: str = "uploaded",
) -> None:
    with transaction() as conn:
        user = conn.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()
        assert user is not None
        params: dict[str, Any] = {
            "asset_id": asset_id,
            "project_id": project_id,
            "asset_kind": asset_kind,
            "object_key": f"projects/{project_id}/{asset_id}",
            "original_filename": original_filename,
            "display_name": original_filename,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "content_hash_sha256": hashlib.sha256(asset_id.encode("utf-8")).hexdigest(),
            "upload_status": upload_status,
            "created_by": user["id"],
        }
        conn.execute(
            """
            INSERT INTO project_assets (
                id, project_id, asset_kind, object_key, original_filename, display_name,
                content_type, size_bytes, content_hash_sha256, r2_etag, upload_status,
                created_by, uploaded_at, metadata
            )
            VALUES (
                %(asset_id)s, %(project_id)s, %(asset_kind)s, %(object_key)s,
                %(original_filename)s, %(display_name)s, %(content_type)s,
                %(size_bytes)s, %(content_hash_sha256)s, 'etag', %(upload_status)s,
                %(created_by)s,
                CASE WHEN %(upload_status)s = 'uploaded' THEN now() ELSE NULL END,
                '{"thumbnail_status": "pending"}'::jsonb
            )
            """,
            params,
        )
