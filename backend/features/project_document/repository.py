"""Raw-SQL repository functions for versioned project documents."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb

from features.project_document.document import ProjectDocumentV1

PROJECT_VERSION_PUBLIC_COLUMNS = """
    id, project_id, name, kind, locked, schema_version,
    body_size_bytes, created_at, updated_at
"""


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


def upsert_draft(
    conn: Connection[Any],
    version_id: UUID,
    user_id: UUID,
    body: ProjectDocumentV1,
    base_version_etag: str,
    draft_etag: str,
    updated_via: str = "browser",
) -> str:
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
            "body": Jsonb(body.model_dump(mode="json")),
            "schema_version": body.schema_version,
            "base_version_etag": base_version_etag,
            "draft_etag": draft_etag,
            "updated_via": updated_via,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Draft upsert did not return a row.")
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


def save_draft_to_version(
    conn: Connection[Any],
    project_id: UUID,
    version_id: UUID,
    user_id: UUID,
    body: ProjectDocumentV1,
    body_size_bytes: int,
) -> dict[str, Any]:
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
            "body": Jsonb(body.model_dump(mode="json")),
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
) -> dict[str, Any]:
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
            "body": Jsonb(body.model_dump(mode="json")),
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
    return row


def patch_version_metadata(
    conn: Connection[Any],
    project_id: UUID,
    version_id: UUID,
    user_id: UUID,
    locked: bool | None,
    make_active: bool,
) -> dict[str, Any]:
    row = conn.execute(
        f"""
        UPDATE project_versions
        SET locked = COALESCE(%(locked)s, locked),
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
