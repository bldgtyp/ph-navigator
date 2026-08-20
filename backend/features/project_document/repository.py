"""Raw-SQL repository functions for versioned project documents."""

from __future__ import annotations

from time import perf_counter
from typing import Any
from uuid import UUID

import structlog
from psycopg import Connection
from psycopg.types.json import Jsonb

from features.project_document.document import ProjectDocumentV1
from features.project_document.validation import SerializedProjectDocument, serialize_document

log = structlog.get_logger(__name__)

PROJECT_VERSION_PUBLIC_COLUMNS = """
    id, project_id, name, kind, locked, schema_version,
    body_size_bytes, created_at, updated_at
"""


def lock_project_for_version_mutation(
    conn: Connection[Any],
    project_id: UUID,
) -> dict[str, Any] | None:
    """Acquire the project row before any Version row in mixed mutations."""
    return conn.execute(
        """
        SELECT id, active_version_id
        FROM projects
        WHERE id = %(project_id)s
          AND deleted_at IS NULL
        FOR UPDATE
        """,
        {"project_id": project_id},
    ).fetchone()


def get_project_version_public(
    conn: Connection[Any],
    project_id: UUID,
    version_id: UUID,
) -> dict[str, Any] | None:
    return conn.execute(
        f"""
        SELECT {PROJECT_VERSION_PUBLIC_COLUMNS}
        FROM project_versions
        WHERE project_id = %(project_id)s
          AND id = %(version_id)s
        """,
        {"project_id": project_id, "version_id": version_id},
    ).fetchone()


def get_project_version(conn: Connection[Any], project_id: UUID, version_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        f"""
        SELECT {PROJECT_VERSION_PUBLIC_COLUMNS}, body
        FROM project_versions
        WHERE project_id = %(project_id)s
          AND id = %(version_id)s
        """,
        {"project_id": project_id, "version_id": version_id},
    ).fetchone()


def get_project_version_for_update(conn: Connection[Any], project_id: UUID, version_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        f"""
        SELECT {PROJECT_VERSION_PUBLIC_COLUMNS}, body
        FROM project_versions
        WHERE project_id = %(project_id)s
          AND id = %(version_id)s
        FOR UPDATE
        """,
        {"project_id": project_id, "version_id": version_id},
    ).fetchone()


def get_project_version_metadata_for_update(
    conn: Connection[Any],
    project_id: UUID,
    version_id: UUID,
) -> dict[str, Any] | None:
    return conn.execute(
        f"""
        SELECT {PROJECT_VERSION_PUBLIC_COLUMNS}
        FROM project_versions
        WHERE project_id = %(project_id)s
          AND id = %(version_id)s
        FOR UPDATE
        """,
        {"project_id": project_id, "version_id": version_id},
    ).fetchone()


def lock_project_and_version_for_mutation(
    conn: Connection[Any],
    project_id: UUID,
    version_id: UUID,
    *,
    include_body: bool,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Acquire the shared project-then-Version lock order in one boundary."""
    project = lock_project_for_version_mutation(conn, project_id)
    if project is None:
        return None, None
    get_version = get_project_version_for_update if include_body else get_project_version_metadata_for_update
    return project, get_version(conn, project_id, version_id)


def list_project_versions_for_update(conn: Connection[Any], project_id: UUID) -> list[dict[str, Any]]:
    """Lock every Version in stable ID order for guarded deletion."""
    rows = conn.execute(
        f"""
        SELECT {PROJECT_VERSION_PUBLIC_COLUMNS}, parent_version_id
        FROM project_versions
        WHERE project_id = %(project_id)s
        ORDER BY id
        FOR UPDATE
        """,
        {"project_id": project_id},
    ).fetchall()
    return list(rows)


def get_draft(conn: Connection[Any], version_id: UUID, user_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT version_id, user_id, body, schema_version, base_version_etag,
               draft_etag, last_patched_at, updated_via
        FROM project_version_drafts
        WHERE version_id = %(version_id)s
          AND user_id = %(user_id)s
        """,
        {"version_id": version_id, "user_id": user_id},
    ).fetchone()


def get_draft_for_update(conn: Connection[Any], version_id: UUID, user_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT version_id, user_id, body, schema_version, base_version_etag,
               draft_etag, last_patched_at, updated_via
        FROM project_version_drafts
        WHERE version_id = %(version_id)s
          AND user_id = %(user_id)s
        FOR UPDATE
        """,
        {"version_id": version_id, "user_id": user_id},
    ).fetchone()


def list_bodies_for_project(conn: Connection[Any], project_id: UUID) -> list[dict[str, Any]]:
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
    return [dict(row) for row in rows]


def upsert_draft(
    conn: Connection[Any],
    version_id: UUID,
    user_id: UUID,
    body: ProjectDocumentV1,
    base_version_etag: str,
    draft_etag: str,
    updated_via: str = "browser",
    *,
    serialized_body: SerializedProjectDocument | None = None,
) -> str:
    serialized = serialized_body or serialize_document(body)
    start = perf_counter()
    row = conn.execute(
        """
        INSERT INTO project_version_drafts (
            version_id, user_id, body, schema_version, base_version_etag,
            draft_etag, updated_via
        )
        VALUES (
            %(version_id)s, %(user_id)s, %(body)s, %(schema_version)s,
            %(base_version_etag)s, %(draft_etag)s, %(updated_via)s
        )
        ON CONFLICT (version_id, user_id)
        DO UPDATE SET body = EXCLUDED.body,
                      schema_version = EXCLUDED.schema_version,
                      draft_etag = EXCLUDED.draft_etag,
                      last_patched_at = now(),
                      updated_via = EXCLUDED.updated_via
        RETURNING draft_etag
        """,
        {
            "version_id": version_id,
            "user_id": user_id,
            "body": Jsonb(serialized.json_value),
            "schema_version": body.schema_version,
            "base_version_etag": base_version_etag,
            "draft_etag": draft_etag,
            "updated_via": updated_via,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Draft upsert did not return a row.")
    _log_saved(version_id, "draft", body_size_bytes=serialized.size_bytes, db_ms=_duration_ms(start))
    return str(row["draft_etag"])


def delete_draft(conn: Connection[Any], version_id: UUID, user_id: UUID) -> bool:
    row = conn.execute(
        """
        DELETE FROM project_version_drafts
        WHERE version_id = %(version_id)s
          AND user_id = %(user_id)s
        RETURNING version_id
        """,
        {"version_id": version_id, "user_id": user_id},
    ).fetchone()
    return row is not None


def count_version_drafts(conn: Connection[Any], version_id: UUID) -> int:
    row = conn.execute(
        """
        SELECT count(*) AS count
        FROM project_version_drafts
        WHERE version_id = %(version_id)s
        """,
        {"version_id": version_id},
    ).fetchone()
    return int(row["count"]) if row is not None else 0


def delete_project_version(conn: Connection[Any], project_id: UUID, version_id: UUID) -> bool:
    row = conn.execute(
        """
        DELETE FROM project_versions
        WHERE project_id = %(project_id)s
          AND id = %(version_id)s
        RETURNING id
        """,
        {"project_id": project_id, "version_id": version_id},
    ).fetchone()
    return row is not None


def rewrite_draft_body(
    conn: Connection[Any],
    version_id: UUID,
    user_id: UUID,
    body: ProjectDocumentV1,
    draft_etag: str,
    *,
    serialized_body: SerializedProjectDocument | None = None,
) -> dict[str, Any]:
    """Rewrite a stale draft cache row after a read-time document upgrade."""

    serialized = serialized_body or serialize_document(body)
    start = perf_counter()
    row = conn.execute(
        """
        UPDATE project_version_drafts
        SET body = %(body)s,
            schema_version = %(schema_version)s,
            draft_etag = %(draft_etag)s,
            last_patched_at = now()
        WHERE version_id = %(version_id)s
          AND user_id = %(user_id)s
        RETURNING draft_etag, last_patched_at
        """,
        {
            "version_id": version_id,
            "user_id": user_id,
            "body": Jsonb(serialized.json_value),
            "schema_version": body.schema_version,
            "draft_etag": draft_etag,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Draft rewrite did not return a row.")
    _log_saved(version_id, "draft", body_size_bytes=serialized.size_bytes, db_ms=_duration_ms(start))
    return dict(row)


def save_draft_to_version(
    conn: Connection[Any],
    project_id: UUID,
    version_id: UUID,
    user_id: UUID,
    body: ProjectDocumentV1,
    body_size_bytes: int,
    *,
    serialized_body: SerializedProjectDocument | None = None,
) -> dict[str, Any]:
    serialized = serialized_body or serialize_document(body)
    start = perf_counter()
    row = conn.execute(
        f"""
        UPDATE project_versions
        SET body = %(body)s,
            schema_version = %(schema_version)s,
            body_size_bytes = %(body_size_bytes)s,
            updated_at = now(),
            updated_by = %(user_id)s
        WHERE project_id = %(project_id)s
          AND id = %(version_id)s
        RETURNING {PROJECT_VERSION_PUBLIC_COLUMNS}
        """,
        {
            "project_id": project_id,
            "version_id": version_id,
            "user_id": user_id,
            "body": Jsonb(serialized.json_value),
            "schema_version": body.schema_version,
            "body_size_bytes": body_size_bytes,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Project version save did not return a row.")
    conn.execute(
        """
        UPDATE projects
        SET last_saved_at = now(),
            updated_at = now()
        WHERE id = %(project_id)s
        """,
        {"project_id": project_id},
    )
    _log_saved(version_id, "version", body_size_bytes=body_size_bytes, db_ms=_duration_ms(start))
    return row


def insert_version_from_body(
    conn: Connection[Any],
    project_id: UUID,
    parent_version_id: UUID,
    user_id: UUID,
    name: str,
    kind: str,
    locked: bool,
    body: ProjectDocumentV1,
    body_size_bytes: int,
    *,
    serialized_body: SerializedProjectDocument | None = None,
) -> dict[str, Any]:
    serialized = serialized_body or serialize_document(body)
    start = perf_counter()
    row = conn.execute(
        f"""
        INSERT INTO project_versions (
            project_id, parent_version_id, name, kind, locked, body,
            schema_version, body_size_bytes, created_by, updated_by
        )
        VALUES (
            %(project_id)s, %(parent_version_id)s, %(name)s, %(kind)s,
            %(locked)s, %(body)s, %(schema_version)s, %(body_size_bytes)s,
            %(user_id)s, %(user_id)s
        )
        RETURNING {PROJECT_VERSION_PUBLIC_COLUMNS}
        """,
        {
            "project_id": project_id,
            "parent_version_id": parent_version_id,
            "name": name,
            "kind": kind,
            "locked": locked,
            "body": Jsonb(serialized.json_value),
            "schema_version": body.schema_version,
            "body_size_bytes": body_size_bytes,
            "user_id": user_id,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Project version insert did not return a row.")
    conn.execute(
        """
        UPDATE projects
        SET active_version_id = %(version_id)s,
            last_saved_at = now(),
            updated_at = now()
        WHERE id = %(project_id)s
        """,
        {"project_id": project_id, "version_id": row["id"]},
    )
    _log_saved(row["id"], "version", body_size_bytes=body_size_bytes, db_ms=_duration_ms(start))
    return row


def _log_saved(version_id: UUID, source: str, *, body_size_bytes: int, db_ms: float) -> None:
    log.info("project_document.saved", version_id=str(version_id), source=source, bytes=body_size_bytes, db_ms=db_ms)


def _duration_ms(start: float) -> float:
    return round((perf_counter() - start) * 1000, 2)


def patch_version_metadata(
    conn: Connection[Any],
    project_id: UUID,
    version_id: UUID,
    user_id: UUID,
    name: str | None,
    locked: bool | None,
    make_active: bool,
) -> dict[str, Any]:
    row = conn.execute(
        f"""
        UPDATE project_versions
        SET name = COALESCE(%(name)s, name),
            locked = COALESCE(%(locked)s, locked),
            updated_at = now(),
            updated_by = %(user_id)s
        WHERE project_id = %(project_id)s
          AND id = %(version_id)s
        RETURNING {PROJECT_VERSION_PUBLIC_COLUMNS}
        """,
        {
            "project_id": project_id,
            "version_id": version_id,
            "user_id": user_id,
            "name": name,
            "locked": locked,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Project version metadata update did not return a row.")
    if make_active:
        conn.execute(
            """
            UPDATE projects
            SET active_version_id = %(version_id)s,
                updated_at = now()
            WHERE id = %(project_id)s
            """,
            {"project_id": project_id, "version_id": version_id},
        )
    return row
