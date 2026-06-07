"""Raw-SQL repository for the Window-Glazing catalog."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from psycopg import Connection, sql

from features.catalogs._shared import (
    reactivate_catalog_record,
    soft_delete_catalog_record,
)

_TABLE = "catalog_glazing_types"

_MANUFACTURERS_QUERY = sql.SQL(
    """
    SELECT manufacturer, COUNT(*) AS product_count
    FROM catalog_glazing_types
    WHERE deleted_at IS NULL AND manufacturer IS NOT NULL AND manufacturer <> ''
    GROUP BY manufacturer
    ORDER BY LOWER(manufacturer) ASC
    """
)


def list_manufacturers(conn: Connection[Any]) -> list[dict[str, Any]]:
    """Return ``[{manufacturer, product_count}]`` for all active glazing
    rows. Mirrors ``frame_types.repository.list_manufacturers``."""

    rows = conn.execute(_MANUFACTURERS_QUERY).fetchall()
    return list(rows)


_SELECT = """
SELECT
    id,
    name,
    manufacturer,
    brand,
    suffix,
    u_value_w_m2k,
    g_value,
    color,
    source,
    datasheet_url,
    comments,
    (deleted_at IS NULL) AS is_active,
    created_at,
    created_by,
    updated_at,
    updated_by
FROM catalog_glazing_types
"""

_UPDATABLE_FIELDS = frozenset(
    {
        "name",
        "manufacturer",
        "brand",
        "suffix",
        "u_value_w_m2k",
        "g_value",
        "color",
        "source",
        "datasheet_url",
        "comments",
    }
)


def list_glazing_types(
    conn: Connection[Any],
    include_inactive: bool = False,
    *,
    manufacturers: list[str] | None = None,
) -> list[dict[str, Any]]:
    clauses: list[sql.Composable] = []
    params: dict[str, Any] = {}
    if not include_inactive:
        clauses.append(sql.SQL("deleted_at IS NULL"))
    if manufacturers is not None:
        if not manufacturers:
            return []
        clauses.append(sql.SQL("LOWER(manufacturer) = ANY(%(manufacturers)s)"))
        params["manufacturers"] = [m.lower() for m in manufacturers]
    where = sql.SQL("") if not clauses else sql.SQL("WHERE ") + sql.SQL(" AND ").join(clauses)
    query = sql.SQL("{select} {where} ORDER BY name ASC, id ASC").format(
        select=sql.SQL(_SELECT),
        where=where,
    )
    rows = conn.execute(query, params).fetchall()
    return list(rows)


def get_glazing_type(conn: Connection[Any], record_id: str) -> dict[str, Any] | None:
    query = sql.SQL("{select} WHERE id = %(id)s").format(select=sql.SQL(_SELECT))
    return conn.execute(query, {"id": record_id}).fetchone()


def list_sibling_names(conn: Connection[Any], *, exclude_id: str) -> list[str]:
    """Return names of all active rows except ``exclude_id``."""
    rows = conn.execute(
        "SELECT name FROM catalog_glazing_types WHERE deleted_at IS NULL AND id <> %(exclude_id)s",
        {"exclude_id": exclude_id},
    ).fetchall()
    return [row["name"] for row in rows]


def insert_glazing_type(
    conn: Connection[Any],
    *,
    record_id: str,
    name: str,
    manufacturer: str | None,
    brand: str | None,
    suffix: str | None,
    u_value_w_m2k: float | None,
    g_value: float | None,
    color: str | None,
    source: str | None,
    datasheet_url: str | None,
    comments: str | None,
    user_id: UUID,
) -> None:
    conn.execute(
        """
        INSERT INTO catalog_glazing_types (
            id, name,
            manufacturer, brand, suffix,
            u_value_w_m2k, g_value,
            color, source, datasheet_url, comments,
            created_by, updated_by
        )
        VALUES (
            %(id)s, %(name)s,
            %(manufacturer)s, %(brand)s, %(suffix)s,
            %(u_value_w_m2k)s, %(g_value)s,
            %(color)s, %(source)s, %(datasheet_url)s, %(comments)s,
            %(user_id)s, %(user_id)s
        )
        """,
        {
            "id": record_id,
            "name": name,
            "manufacturer": manufacturer,
            "brand": brand,
            "suffix": suffix,
            "u_value_w_m2k": u_value_w_m2k,
            "g_value": g_value,
            "color": color,
            "source": source,
            "datasheet_url": datasheet_url,
            "comments": comments,
            "user_id": user_id,
        },
    )


def update_glazing_type(
    conn: Connection[Any],
    record_id: str,
    values: Mapping[str, object],
    user_id: UUID,
) -> bool:
    """In-place patch. Returns False if the row is missing or soft-deleted."""
    updates = {k: v for k, v in values.items() if k in _UPDATABLE_FIELDS}
    assignment_parts: list[sql.Composable] = [
        sql.SQL("{} = {}").format(sql.Identifier(key), sql.Placeholder(key)) for key in sorted(updates)
    ]
    assignment_parts.append(sql.SQL("updated_at = now()"))
    assignment_parts.append(sql.SQL("updated_by = %(updated_by)s"))
    params: dict[str, Any] = dict(updates)
    params["updated_by"] = user_id
    params["id"] = record_id
    row = conn.execute(
        sql.SQL(
            """
            UPDATE catalog_glazing_types
            SET {assignments}
            WHERE id = %(id)s AND deleted_at IS NULL
            RETURNING id
            """
        ).format(assignments=sql.SQL(", ").join(assignment_parts)),
        params,
    ).fetchone()
    return row is not None


def soft_delete_glazing_type(conn: Connection[Any], record_id: str, user_id: UUID) -> bool:
    return soft_delete_catalog_record(conn, table=_TABLE, record_id=record_id, user_id=user_id)


def reactivate_glazing_type(conn: Connection[Any], record_id: str, user_id: UUID) -> bool:
    return reactivate_catalog_record(conn, table=_TABLE, record_id=record_id, user_id=user_id)
