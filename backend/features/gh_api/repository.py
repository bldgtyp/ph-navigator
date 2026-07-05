"""Raw-SQL reads for the Grasshopper Data API.

Only the bt_number → live-project resolution is new here; version reads reuse
`features/project_document/repository.py` (saved versions only, never drafts).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection

from features.project_document.repository import PROJECT_VERSION_PUBLIC_COLUMNS
from features.projects.repository import PROJECT_COLUMNS, list_versions_for_project

__all__ = ["get_live_project_by_bt_number", "get_saved_version_meta", "list_versions_for_project"]


def get_live_project_by_bt_number(conn: Connection[Any], bt_number: str) -> dict[str, Any] | None:
    """Resolve a non-deleted project by its GH-facing bt_number key.

    Returns the full `PROJECT_COLUMNS` row (so the caller can build a
    `ProjectSummary`), or ``None`` when no live project owns the bt_number.
    The partial unique index `uq_projects_bt_number_live` guarantees at most
    one live row per bt_number.
    """
    return conn.execute(
        f"""
        SELECT {PROJECT_COLUMNS}
        FROM projects
        WHERE bt_number = %(bt_number)s
          AND deleted_at IS NULL
        """,
        {"bt_number": bt_number},
    ).fetchone()


def get_saved_version_meta(conn: Connection[Any], project_id: UUID, version_id: UUID) -> dict[str, Any] | None:
    """Fetch a saved version's metadata (no body) for the response envelope.

    Serves both `?version=` pinning and the active-version default. Rows here are
    always saved versions — drafts live in `project_version_drafts` and are never
    read. Returns ``None`` when the version doesn't belong to the project.
    """
    return conn.execute(
        f"""
        SELECT {PROJECT_VERSION_PUBLIC_COLUMNS}
        FROM project_versions
        WHERE project_id = %(project_id)s
          AND id = %(version_id)s
        """,
        {"project_id": project_id, "version_id": version_id},
    ).fetchone()
