"""Raw-SQL repository for the Materials catalog."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from psycopg import Connection, sql

from features.catalogs._shared import (
    reactivate_catalog_record,
    soft_delete_catalog_record,
)

_TABLE = "catalog_materials"

_SELECT = """
SELECT
    id,
    name,
    category,
    density_kg_m3,
    specific_heat_j_kgk,
    conductivity_w_mk,
    emissivity,
    color,
    source,
    url,
    comments,
    (deleted_at IS NULL) AS is_active,
    created_at,
    created_by,
    updated_at,
    updated_by
FROM catalog_materials
"""

_UPDATABLE_FIELDS = frozenset(
    {
        "name",
        "category",
        "density_kg_m3",
        "specific_heat_j_kgk",
        "conductivity_w_mk",
        "emissivity",
        "color",
        "source",
        "url",
        "comments",
    }
)


def list_materials(conn: Connection[Any], include_inactive: bool = False) -> list[dict[str, Any]]:
    where = sql.SQL("") if include_inactive else sql.SQL("WHERE deleted_at IS NULL")
    query = sql.SQL("{select} {where} ORDER BY name ASC, id ASC").format(
        select=sql.SQL(_SELECT),
        where=where,
    )
    rows = conn.execute(query).fetchall()
    return list(rows)


def get_material(conn: Connection[Any], material_id: str) -> dict[str, Any] | None:
    query = sql.SQL("{select} WHERE id = %(id)s").format(select=sql.SQL(_SELECT))
    return conn.execute(query, {"id": material_id}).fetchone()


def get_materials_by_ids(conn: Connection[Any], material_ids: list[str]) -> list[dict[str, Any]]:
    if not material_ids:
        return []
    query = sql.SQL("{select} WHERE id = ANY(%(ids)s)").format(select=sql.SQL(_SELECT))
    return list(conn.execute(query, {"ids": material_ids}).fetchall())


def insert_material(
    conn: Connection[Any],
    *,
    record_id: str,
    name: str,
    category: str,
    density_kg_m3: float | None,
    specific_heat_j_kgk: float | None,
    conductivity_w_mk: float | None,
    emissivity: float | None,
    color: str | None,
    source: str | None,
    url: str | None,
    comments: str | None,
    user_id: UUID,
) -> None:
    conn.execute(
        """
        INSERT INTO catalog_materials (
            id, name, category,
            density_kg_m3, specific_heat_j_kgk, conductivity_w_mk, emissivity,
            color, source, url, comments,
            created_by, updated_by
        )
        VALUES (
            %(id)s, %(name)s, %(category)s,
            %(density_kg_m3)s, %(specific_heat_j_kgk)s, %(conductivity_w_mk)s, %(emissivity)s,
            %(color)s, %(source)s, %(url)s, %(comments)s,
            %(user_id)s, %(user_id)s
        )
        """,
        {
            "id": record_id,
            "name": name,
            "category": category,
            "density_kg_m3": density_kg_m3,
            "specific_heat_j_kgk": specific_heat_j_kgk,
            "conductivity_w_mk": conductivity_w_mk,
            "emissivity": emissivity,
            "color": color,
            "source": source,
            "url": url,
            "comments": comments,
            "user_id": user_id,
        },
    )


def update_material(
    conn: Connection[Any],
    material_id: str,
    values: Mapping[str, object],
    user_id: UUID,
) -> bool:
    """In-place patch. Returns False if the row is missing or soft-deleted."""
    updates = {k: v for k, v in values.items() if k in _UPDATABLE_FIELDS}
    assignment_parts: list[sql.Composable] = [
        sql.SQL("{} = {}").format(sql.Identifier(key), sql.Placeholder(key))
        for key in sorted(updates)
    ]
    assignment_parts.append(sql.SQL("updated_at = now()"))
    assignment_parts.append(sql.SQL("updated_by = %(updated_by)s"))
    params: dict[str, Any] = dict(updates)
    params["updated_by"] = user_id
    params["id"] = material_id
    row = conn.execute(
        sql.SQL(
            """
            UPDATE catalog_materials
            SET {assignments}
            WHERE id = %(id)s AND deleted_at IS NULL
            RETURNING id
            """
        ).format(assignments=sql.SQL(", ").join(assignment_parts)),
        params,
    ).fetchone()
    return row is not None


def soft_delete_material(conn: Connection[Any], material_id: str, user_id: UUID) -> bool:
    return soft_delete_catalog_record(conn, table=_TABLE, record_id=material_id, user_id=user_id)


def reactivate_material(conn: Connection[Any], material_id: str, user_id: UUID) -> bool:
    return reactivate_catalog_record(conn, table=_TABLE, record_id=material_id, user_id=user_id)
