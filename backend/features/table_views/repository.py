"""Raw-SQL repository for per-user project-table view-state rows."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb


def get(
    conn: Connection[Any],
    user_id: UUID,
    project_id: UUID,
    table_key: str,
) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT user_id, project_id, table_key,
               view_state_schema_version, view_state,
               view_state_size_bytes, updated_at
        FROM user_table_views
        WHERE user_id = %(user_id)s
          AND project_id = %(project_id)s
          AND table_key = %(table_key)s
        """,
        {"user_id": user_id, "project_id": project_id, "table_key": table_key},
    ).fetchone()


def upsert(
    conn: Connection[Any],
    user_id: UUID,
    project_id: UUID,
    table_key: str,
    schema_version: int,
    view_state: dict[str, Any],
    size_bytes: int,
) -> dict[str, Any]:
    row = conn.execute(
        """
        INSERT INTO user_table_views (
            user_id, project_id, table_key,
            view_state_schema_version, view_state, view_state_size_bytes,
            updated_at
        )
        VALUES (
            %(user_id)s, %(project_id)s, %(table_key)s,
            %(schema_version)s, %(view_state)s, %(size_bytes)s,
            now()
        )
        ON CONFLICT (user_id, project_id, table_key) DO UPDATE
        SET view_state_schema_version = EXCLUDED.view_state_schema_version,
            view_state = EXCLUDED.view_state,
            view_state_size_bytes = EXCLUDED.view_state_size_bytes,
            updated_at = now()
        RETURNING user_id, project_id, table_key,
                  view_state_schema_version, view_state,
                  view_state_size_bytes, updated_at
        """,
        {
            "user_id": user_id,
            "project_id": project_id,
            "table_key": table_key,
            "schema_version": schema_version,
            "view_state": Jsonb(view_state),
            "size_bytes": size_bytes,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("user_table_views upsert did not return a row.")
    return row


def delete(
    conn: Connection[Any],
    user_id: UUID,
    project_id: UUID,
    table_key: str,
) -> bool:
    row = conn.execute(
        """
        DELETE FROM user_table_views
        WHERE user_id = %(user_id)s
          AND project_id = %(project_id)s
          AND table_key = %(table_key)s
        RETURNING table_key
        """,
        {"user_id": user_id, "project_id": project_id, "table_key": table_key},
    ).fetchone()
    return row is not None
