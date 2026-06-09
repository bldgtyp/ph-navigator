"""Repository helpers for heat-pump active-version access."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection


def get_active_version_id(conn: Connection[Any], project_id: UUID) -> UUID | None:
    row = conn.execute(
        """
        SELECT active_version_id
        FROM projects
        WHERE id = %(project_id)s
          AND deleted_at IS NULL
        """,
        {"project_id": project_id},
    ).fetchone()
    if row is None:
        return None
    return row["active_version_id"]
