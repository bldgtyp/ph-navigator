"""Raw-SQL repository functions for project lifecycle status items."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from psycopg import Connection

from features.project_status.models import StatusItemCreateRequest


def list_status_items(conn: Connection[Any], project_id: UUID) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, project_id, order_index, title, state, completion_date,
               description, created_at, created_by, updated_at, updated_by
        FROM project_status_items
        WHERE project_id = %(project_id)s
          AND deleted_at IS NULL
        ORDER BY order_index ASC, created_at ASC
        """,
        {"project_id": project_id},
    ).fetchall()
    return list(rows)


def get_status_item(conn: Connection[Any], project_id: UUID, item_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT id, project_id, order_index, title, state, completion_date,
               description, created_at, created_by, updated_at, updated_by
        FROM project_status_items
        WHERE project_id = %(project_id)s
          AND id = %(item_id)s
          AND deleted_at IS NULL
        """,
        {"project_id": project_id, "item_id": item_id},
    ).fetchone()


def count_status_items(conn: Connection[Any], project_id: UUID) -> int:
    row = conn.execute(
        """
        SELECT count(*) AS n
        FROM project_status_items
        WHERE project_id = %(project_id)s
          AND deleted_at IS NULL
        """,
        {"project_id": project_id},
    ).fetchone()
    return int(row["n"]) if row else 0


def next_order_index(conn: Connection[Any], project_id: UUID) -> float:
    row = conn.execute(
        """
        SELECT coalesce(max(order_index), 0) + 1 AS next_order
        FROM project_status_items
        WHERE project_id = %(project_id)s
          AND deleted_at IS NULL
        """,
        {"project_id": project_id},
    ).fetchone()
    return float(row["next_order"]) if row else 1.0


def insert_status_item(
    conn: Connection[Any],
    project_id: UUID,
    payload: StatusItemCreateRequest,
    order_index: float,
    user_id: UUID,
) -> dict[str, Any]:
    row = conn.execute(
        """
        INSERT INTO project_status_items (
            project_id, order_index, title, state, completion_date,
            description, created_by, updated_by
        )
        VALUES (
            %(project_id)s, %(order_index)s, %(title)s, %(state)s,
            %(completion_date)s, %(description)s, %(user_id)s, %(user_id)s
        )
        RETURNING id, project_id, order_index, title, state, completion_date,
                  description, created_at, created_by, updated_at, updated_by
        """,
        {
            "project_id": project_id,
            "order_index": order_index,
            "title": payload.title,
            "state": payload.state,
            "completion_date": payload.completion_date,
            "description": payload.description,
            "user_id": user_id,
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Status item insert did not return a row.")
    return row


def update_status_item(
    conn: Connection[Any],
    project_id: UUID,
    item_id: UUID,
    values: Mapping[str, object],
    user_id: UUID,
) -> dict[str, Any] | None:
    params = {
        "project_id": project_id,
        "item_id": item_id,
        "updated_by": user_id,
        "title_is_set": "title" in values,
        "title": values.get("title"),
        "state_is_set": "state" in values,
        "state": values.get("state"),
        "completion_date_is_set": "completion_date" in values,
        "completion_date": values.get("completion_date"),
        "description_is_set": "description" in values,
        "description": values.get("description"),
        "order_index_is_set": "order_index" in values,
        "order_index": values.get("order_index"),
    }
    return conn.execute(
        """
        UPDATE project_status_items
        SET title = CASE WHEN %(title_is_set)s THEN %(title)s ELSE title END,
            state = CASE WHEN %(state_is_set)s THEN %(state)s ELSE state END,
            completion_date = CASE
                WHEN %(completion_date_is_set)s THEN %(completion_date)s
                ELSE completion_date
            END,
            description = CASE
                WHEN %(description_is_set)s THEN %(description)s
                ELSE description
            END,
            order_index = CASE
                WHEN %(order_index_is_set)s THEN %(order_index)s
                ELSE order_index
            END,
            updated_at = now(),
            updated_by = %(updated_by)s
        WHERE project_id = %(project_id)s
          AND id = %(item_id)s
          AND deleted_at IS NULL
        RETURNING id, project_id, order_index, title, state, completion_date,
                  description, created_at, created_by, updated_at, updated_by
        """,
        params,
    ).fetchone()


def soft_delete_status_item(conn: Connection[Any], project_id: UUID, item_id: UUID, user_id: UUID) -> bool:
    row = conn.execute(
        """
        UPDATE project_status_items
        SET deleted_at = now(),
            updated_at = now(),
            updated_by = %(updated_by)s
        WHERE project_id = %(project_id)s
          AND id = %(item_id)s
          AND deleted_at IS NULL
        RETURNING id
        """,
        {"project_id": project_id, "item_id": item_id, "updated_by": user_id},
    ).fetchone()
    return row is not None
