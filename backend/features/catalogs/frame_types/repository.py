"""Raw-SQL repository for the Window-Frame catalog."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from psycopg import Connection, sql

from features.catalogs._shared import (
    reactivate_catalog_record,
    soft_delete_catalog_record,
)

_TABLE = "catalog_frame_types"

_SELECT = """
SELECT
    id,
    name,
    manufacturer,
    brand,
    "use",
    operation,
    location,
    mull_type,
    prefix,
    suffix,
    material,
    width_mm,
    u_value_w_m2k,
    psi_g_w_mk,
    psi_install_w_mk,
    color,
    source,
    comments,
    (deleted_at IS NULL) AS is_active,
    created_at,
    created_by,
    updated_at,
    updated_by
FROM catalog_frame_types
"""

_UPDATABLE_FIELDS = frozenset(
    {
        "name",
        "manufacturer",
        "brand",
        "use",
        "operation",
        "location",
        "mull_type",
        "prefix",
        "suffix",
        "material",
        "width_mm",
        "u_value_w_m2k",
        "psi_g_w_mk",
        "psi_install_w_mk",
        "color",
        "source",
        "comments",
    }
)


def list_frame_types(conn: Connection[Any], include_inactive: bool = False) -> list[dict[str, Any]]:
    where = sql.SQL("") if include_inactive else sql.SQL("WHERE deleted_at IS NULL")
    query = sql.SQL("{select} {where} ORDER BY name ASC, id ASC").format(
        select=sql.SQL(_SELECT),
        where=where,
    )
    rows = conn.execute(query).fetchall()
    return list(rows)


def get_frame_type(conn: Connection[Any], record_id: str) -> dict[str, Any] | None:
    query = sql.SQL("{select} WHERE id = %(id)s").format(select=sql.SQL(_SELECT))
    return conn.execute(query, {"id": record_id}).fetchone()


def list_sibling_names(conn: Connection[Any], *, exclude_id: str) -> list[str]:
    """Return names of all active rows except ``exclude_id``."""
    rows = conn.execute(
        "SELECT name FROM catalog_frame_types WHERE deleted_at IS NULL AND id <> %(exclude_id)s",
        {"exclude_id": exclude_id},
    ).fetchall()
    return [row["name"] for row in rows]


def insert_frame_type(
    conn: Connection[Any],
    *,
    record_id: str,
    name: str,
    manufacturer: str | None,
    brand: str | None,
    use: str | None,
    operation: str | None,
    location: str | None,
    mull_type: str | None,
    prefix: str | None,
    suffix: str | None,
    material: str | None,
    width_mm: float | None,
    u_value_w_m2k: float | None,
    psi_g_w_mk: float | None,
    psi_install_w_mk: float | None,
    color: str | None,
    source: str | None,
    comments: str | None,
    user_id: UUID,
) -> None:
    conn.execute(
        """
        INSERT INTO catalog_frame_types (
            id, name,
            manufacturer, brand,
            "use", operation, location, mull_type,
            prefix, suffix, material,
            width_mm, u_value_w_m2k, psi_g_w_mk, psi_install_w_mk,
            color, source, comments,
            created_by, updated_by
        )
        VALUES (
            %(id)s, %(name)s,
            %(manufacturer)s, %(brand)s,
            %(use)s, %(operation)s, %(location)s, %(mull_type)s,
            %(prefix)s, %(suffix)s, %(material)s,
            %(width_mm)s, %(u_value_w_m2k)s, %(psi_g_w_mk)s, %(psi_install_w_mk)s,
            %(color)s, %(source)s, %(comments)s,
            %(user_id)s, %(user_id)s
        )
        """,
        {
            "id": record_id,
            "name": name,
            "manufacturer": manufacturer,
            "brand": brand,
            "use": use,
            "operation": operation,
            "location": location,
            "mull_type": mull_type,
            "prefix": prefix,
            "suffix": suffix,
            "material": material,
            "width_mm": width_mm,
            "u_value_w_m2k": u_value_w_m2k,
            "psi_g_w_mk": psi_g_w_mk,
            "psi_install_w_mk": psi_install_w_mk,
            "color": color,
            "source": source,
            "comments": comments,
            "user_id": user_id,
        },
    )


def update_frame_type(
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
            UPDATE catalog_frame_types
            SET {assignments}
            WHERE id = %(id)s AND deleted_at IS NULL
            RETURNING id
            """
        ).format(assignments=sql.SQL(", ").join(assignment_parts)),
        params,
    ).fetchone()
    return row is not None


def soft_delete_frame_type(conn: Connection[Any], record_id: str, user_id: UUID) -> bool:
    return soft_delete_catalog_record(conn, table=_TABLE, record_id=record_id, user_id=user_id)


def reactivate_frame_type(conn: Connection[Any], record_id: str, user_id: UUID) -> bool:
    return reactivate_catalog_record(conn, table=_TABLE, record_id=record_id, user_id=user_id)
