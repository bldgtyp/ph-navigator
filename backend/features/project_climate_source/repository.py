"""Raw-SQL repository for project-scoped climate sources.

Project-scoped (every row carries ``project_id``); contrast with the
app-wide ``climate_dataset*`` repository. ``get_source`` returns the
``project_id`` so the service can enforce that a source id belongs to the
project in its URL before mutating it.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection, sql
from psycopg.types.json import Jsonb

SOURCE_COLUMNS = "id, project_id, kind, ref, label, data, created_at, updated_at"

# Columns a PATCH may touch; ``kind`` is immutable.
_UPDATABLE_FIELDS = ("label", "ref", "data")


def list_sources(conn: Connection[Any], project_id: UUID) -> list[dict[str, Any]]:
    """All sources for a project; default first, then newest."""
    return list(
        conn.execute(
            f"""
            SELECT {SOURCE_COLUMNS}
            FROM project_climate_source
            WHERE project_id = %(project_id)s
            ORDER BY created_at DESC, id ASC
            """,
            {"project_id": project_id},
        ).fetchall()
    )


def get_source(conn: Connection[Any], source_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        f"SELECT {SOURCE_COLUMNS} FROM project_climate_source WHERE id = %(id)s",
        {"id": source_id},
    ).fetchone()


def insert_source(
    conn: Connection[Any],
    *,
    source_id: UUID,
    project_id: UUID,
    kind: str,
    ref: str | None,
    label: str | None,
    data: dict[str, Any] | None,
) -> dict[str, Any]:
    row = conn.execute(
        f"""
        INSERT INTO project_climate_source (id, project_id, kind, ref, label, data)
        VALUES (%(id)s, %(project_id)s, %(kind)s, %(ref)s, %(label)s, %(data)s)
        RETURNING {SOURCE_COLUMNS}
        """,
        {
            "id": source_id,
            "project_id": project_id,
            "kind": kind,
            "ref": ref,
            "label": label,
            "data": Jsonb(data) if data is not None else None,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Climate source insert did not return a row.")
    return row


def update_source(conn: Connection[Any], source_id: UUID, values: dict[str, object]) -> dict[str, Any]:
    """Update only the fields the caller explicitly set (``exclude_unset``)."""
    fields = [field for field in _UPDATABLE_FIELDS if field in values]
    if not fields:
        existing = get_source(conn, source_id)
        if existing is None:
            raise RuntimeError("Cannot update a missing climate source.")
        return existing

    assignments = sql.SQL(", ").join(
        sql.SQL("{} = {}").format(sql.Identifier(field), sql.Placeholder(field)) for field in fields
    )
    params: dict[str, object] = {"id": source_id}
    for field in fields:
        value = values[field]
        params[field] = Jsonb(value) if field == "data" and value is not None else value

    row = conn.execute(
        sql.SQL(
            """
            UPDATE project_climate_source
            SET {assignments}, updated_at = now()
            WHERE id = %(id)s
            RETURNING {returning}
            """
        ).format(assignments=assignments, returning=sql.SQL(SOURCE_COLUMNS)),
        params,
    ).fetchone()
    if row is None:
        raise RuntimeError("Climate source update did not return a row.")
    return row


def delete_source(conn: Connection[Any], source_id: UUID) -> None:
    conn.execute("DELETE FROM project_climate_source WHERE id = %(id)s", {"id": source_id})


def get_dataset_location_provider(conn: Connection[Any], location_id: UUID) -> str | None:
    """Provider of the reference-dataset location a phius/phi source pins, or None."""
    row = conn.execute(
        """
        SELECT d.provider
        FROM climate_dataset_location l
        JOIN climate_dataset d ON d.id = l.dataset_id
        WHERE l.id = %(id)s
        """,
        {"id": location_id},
    ).fetchone()
    return str(row["provider"]) if row else None
