"""Raw-SQL repository functions for versioned project documents."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb

from features.project_document.document import ProjectDocumentV1


def get_project_version(conn: Connection[Any], project_id: UUID, version_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT id, project_id, locked, body, schema_version, updated_at
        FROM project_versions
        WHERE project_id = %(project_id)s
          AND id = %(version_id)s
        """,
        {"project_id": project_id, "version_id": version_id},
    ).fetchone()


def get_project_version_for_update(conn: Connection[Any], project_id: UUID, version_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT id, project_id, locked, body, schema_version, updated_at
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
