"""Raw-SQL repository functions for Model tab HBJSON file rows."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from psycopg import Connection

# Every read returns the same joined shape: viewer metadata from
# project_hbjson_files plus the asset facts (size, original filename) and
# the uploader display name the file popover renders.
_FILE_SELECT = """
SELECT h.id, h.project_id, h.asset_id, h.display_name, h.notes,
       h.uploaded_by, h.uploaded_at,
       h.extraction_status, h.extraction_error,
       a.size_bytes, a.original_filename,
       u.display_name AS uploaded_by_display_name
FROM project_hbjson_files h
JOIN project_assets a ON a.id = h.asset_id
JOIN users u ON u.id = h.uploaded_by
"""


def list_hbjson_files(conn: Connection[Any], project_id: UUID) -> list[dict[str, Any]]:
    rows = conn.execute(
        f"""
        {_FILE_SELECT}
        WHERE h.project_id = %(project_id)s
          AND h.deleted_at IS NULL
        ORDER BY h.uploaded_at DESC, h.id DESC
        """,
        {"project_id": project_id},
    ).fetchall()
    return list(rows)


def get_hbjson_file(conn: Connection[Any], project_id: UUID, file_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        f"""
        {_FILE_SELECT}
        WHERE h.project_id = %(project_id)s
          AND h.id = %(file_id)s
          AND h.deleted_at IS NULL
        """,
        {"project_id": project_id, "file_id": file_id},
    ).fetchone()


def find_active_file_by_content_hash(
    conn: Connection[Any], project_id: UUID, content_hash_sha256: str
) -> dict[str, Any] | None:
    """Return the non-deleted row holding this content hash, if any.

    Serves the friendly half of the dedup contract: the 409 payload names
    the existing file so the client can offer "[Switch]". The partial
    unique index is the race-proof backstop.
    """
    return conn.execute(
        """
        SELECT id, display_name, asset_id
        FROM project_hbjson_files
        WHERE project_id = %(project_id)s
          AND content_hash_sha256 = %(content_hash_sha256)s
          AND deleted_at IS NULL
        """,
        {"project_id": project_id, "content_hash_sha256": content_hash_sha256.lower()},
    ).fetchone()


def find_deleted_file_by_asset_id(conn: Connection[Any], project_id: UUID, asset_id: str) -> dict[str, Any] | None:
    """Find a soft-deleted row still holding this asset.

    Needed because `asset_id` is UNIQUE across deleted and live rows: the
    asset layer dedups uploads by content hash, so re-uploading a deleted
    file hands back the original asset — the link step must restore the
    old row rather than insert a second one.
    """
    return conn.execute(
        """
        SELECT id
        FROM project_hbjson_files
        WHERE project_id = %(project_id)s
          AND asset_id = %(asset_id)s
          AND deleted_at IS NOT NULL
        """,
        {"project_id": project_id, "asset_id": asset_id},
    ).fetchone()


def insert_hbjson_file(
    conn: Connection[Any],
    *,
    project_id: UUID,
    asset_id: str,
    display_name: str,
    notes: str | None,
    uploaded_by: UUID,
    content_hash_sha256: str,
) -> UUID:
    row = conn.execute(
        """
        INSERT INTO project_hbjson_files (
            project_id, asset_id, display_name, notes, uploaded_by, content_hash_sha256
        )
        VALUES (
            %(project_id)s, %(asset_id)s, %(display_name)s, %(notes)s,
            %(uploaded_by)s, %(content_hash_sha256)s
        )
        RETURNING id
        """,
        {
            "project_id": project_id,
            "asset_id": asset_id,
            "display_name": display_name,
            "notes": notes,
            "uploaded_by": uploaded_by,
            "content_hash_sha256": content_hash_sha256.lower(),
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("HBJSON file insert did not return a row.")
    return row["id"]


def restore_hbjson_file(
    conn: Connection[Any],
    *,
    project_id: UUID,
    file_id: UUID,
    display_name: str,
    notes: str | None,
    uploaded_by: UUID,
) -> UUID:
    """Bring a soft-deleted row back as if freshly linked.

    The content (and therefore the extraction columns) is unchanged, so
    only the user-facing metadata and provenance reset.
    """
    row = conn.execute(
        """
        UPDATE project_hbjson_files
        SET deleted_at = NULL,
            display_name = %(display_name)s,
            notes = %(notes)s,
            uploaded_by = %(uploaded_by)s,
            uploaded_at = now()
        WHERE project_id = %(project_id)s
          AND id = %(file_id)s
        RETURNING id
        """,
        {
            "project_id": project_id,
            "file_id": file_id,
            "display_name": display_name,
            "notes": notes,
            "uploaded_by": uploaded_by,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("HBJSON file restore did not return a row.")
    return row["id"]


def update_hbjson_file(
    conn: Connection[Any],
    project_id: UUID,
    file_id: UUID,
    values: Mapping[str, object],
) -> UUID | None:
    params = {
        "project_id": project_id,
        "file_id": file_id,
        "display_name_is_set": "display_name" in values,
        "display_name": values.get("display_name"),
        "notes_is_set": "notes" in values,
        "notes": values.get("notes"),
    }
    row = conn.execute(
        """
        UPDATE project_hbjson_files
        SET display_name = CASE
                WHEN %(display_name_is_set)s THEN %(display_name)s
                ELSE display_name
            END,
            notes = CASE WHEN %(notes_is_set)s THEN %(notes)s ELSE notes END
        WHERE project_id = %(project_id)s
          AND id = %(file_id)s
          AND deleted_at IS NULL
        RETURNING id
        """,
        params,
    ).fetchone()
    return row["id"] if row else None


def get_extraction_target(conn: Connection[Any], project_id: UUID, file_id: UUID) -> dict[str, Any] | None:
    """The minimal row the extraction job / artifact serving needs.

    Separate from `_FILE_SELECT` because it carries the asset's R2
    `object_key`, which the public list payload must not leak.
    """
    return conn.execute(
        """
        SELECT h.id, h.asset_id, h.extraction_status, h.extraction_error,
               a.object_key
        FROM project_hbjson_files h
        JOIN project_assets a ON a.id = h.asset_id
        WHERE h.project_id = %(project_id)s
          AND h.id = %(file_id)s
          AND h.deleted_at IS NULL
        """,
        {"project_id": project_id, "file_id": file_id},
    ).fetchone()


def set_extraction_success(
    conn: Connection[Any],
    project_id: UUID,
    file_id: UUID,
    *,
    volume_m3: float,
    envelope_area_m2: float,
    floor_area_m2: float,
) -> None:
    conn.execute(
        """
        UPDATE project_hbjson_files
        SET extraction_status = 'success',
            extraction_error = NULL,
            extracted_volume_m3 = %(volume_m3)s,
            extracted_envelope_area_m2 = %(envelope_area_m2)s,
            extracted_floor_area_m2 = %(floor_area_m2)s,
            extracted_at = now()
        WHERE project_id = %(project_id)s
          AND id = %(file_id)s
        """,
        {
            "project_id": project_id,
            "file_id": file_id,
            "volume_m3": volume_m3,
            "envelope_area_m2": envelope_area_m2,
            "floor_area_m2": floor_area_m2,
        },
    )


def set_extraction_failed(conn: Connection[Any], project_id: UUID, file_id: UUID, *, error: str) -> None:
    """Permanent parse failure (D-16). The file stays listable/renamable/
    deletable — only rendering is off the table."""
    conn.execute(
        """
        UPDATE project_hbjson_files
        SET extraction_status = 'failed',
            extraction_error = %(error)s,
            extracted_volume_m3 = NULL,
            extracted_envelope_area_m2 = NULL,
            extracted_floor_area_m2 = NULL,
            extracted_at = now()
        WHERE project_id = %(project_id)s
          AND id = %(file_id)s
        """,
        {"project_id": project_id, "file_id": file_id, "error": error},
    )


def soft_delete_hbjson_file(conn: Connection[Any], project_id: UUID, file_id: UUID) -> bool:
    row = conn.execute(
        """
        UPDATE project_hbjson_files
        SET deleted_at = now()
        WHERE project_id = %(project_id)s
          AND id = %(file_id)s
          AND deleted_at IS NULL
        RETURNING id
        """,
        {"project_id": project_id, "file_id": file_id},
    ).fetchone()
    return row is not None
