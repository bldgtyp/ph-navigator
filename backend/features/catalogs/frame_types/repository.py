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
from features.project_document.envelope_models import APERTURE_DEFAULT_FRAME_ID

_TABLE = "catalog_frame_types"

_MANUFACTURERS_QUERY = sql.SQL(
    """
    SELECT manufacturer, COUNT(*) AS product_count
    FROM catalog_frame_types
    WHERE deleted_at IS NULL AND manufacturer IS NOT NULL AND manufacturer <> ''
    GROUP BY manufacturer
    ORDER BY LOWER(manufacturer) ASC
    """
)


def list_manufacturers(conn: Connection[Any]) -> list[dict[str, Any]]:
    """Return ``[{manufacturer, product_count}]`` for all active frame rows.

    Skips rows with a null / blank manufacturer; sorts case-insensitively
    so the picker column matches how the user reads it.
    """

    rows = conn.execute(_MANUFACTURERS_QUERY).fetchall()
    return list(rows)


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
    datasheet_url,
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
        "datasheet_url",
        "comments",
    }
)


def list_frame_types(
    conn: Connection[Any],
    include_inactive: bool = False,
    *,
    location: str | None = None,
    operation: str | None = None,
    use: str | None = None,
    manufacturers: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Phase 06 filters compose with AND. ``location``/``operation``/``use``
    match case-insensitively on the column of the same name (``use`` is a
    reserved word so it is double-quoted in SQL). ``manufacturers`` matches
    any of the supplied names case-insensitively; an empty list returns no
    rows (matches the explicit zero-of-set semantics)."""

    clauses: list[sql.Composable] = []
    params: dict[str, Any] = {}
    if not include_inactive:
        clauses.append(sql.SQL("deleted_at IS NULL"))
    if location is not None:
        clauses.append(sql.SQL("LOWER(location) = LOWER(%(location)s)"))
        params["location"] = location
    if operation is not None:
        clauses.append(sql.SQL("LOWER(operation) = LOWER(%(operation)s)"))
        params["operation"] = operation
    if use is not None:
        clauses.append(sql.SQL('LOWER("use") = LOWER(%(use)s)'))
        params["use"] = use
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


def get_frame_type(conn: Connection[Any], record_id: str) -> dict[str, Any] | None:
    query = sql.SQL("{select} WHERE id = %(id)s").format(select=sql.SQL(_SELECT))
    return conn.execute(query, {"id": record_id}).fetchone()


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
    datasheet_url: str | None,
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
            color, source, datasheet_url, comments,
            created_by, updated_by
        )
        VALUES (
            %(id)s, %(name)s,
            %(manufacturer)s, %(brand)s,
            %(use)s, %(operation)s, %(location)s, %(mull_type)s,
            %(prefix)s, %(suffix)s, %(material)s,
            %(width_mm)s, %(u_value_w_m2k)s, %(psi_g_w_mk)s, %(psi_install_w_mk)s,
            %(color)s, %(source)s, %(datasheet_url)s, %(comments)s,
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
            "datasheet_url": datasheet_url,
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


# SQL twin of `_name.compose_frame_name` (and migration 20260623_0039): the
# non-empty parts joined by ' | ' in the fixed order, clamped to 200 chars.
# `concat_ws` skips NULLs; `NULLIF(btrim(x),'')` folds blank → NULL. Keep in
# sync with `_name._NAME_PART_ORDER` (all three implementations must agree).
_COMPOSE_NAME_SQL = """
left(
    concat_ws(
        ' | ',
        NULLIF(btrim(manufacturer), ''),
        NULLIF(btrim(prefix), ''),
        NULLIF(btrim(brand), ''),
        NULLIF(btrim("use"), ''),
        NULLIF(btrim(operation), ''),
        NULLIF(btrim(location), ''),
        NULLIF(btrim(mull_type), ''),
        NULLIF(btrim(suffix), '')
    ),
    200
)
"""


def recompute_names(conn: Connection[Any]) -> None:
    """Recompute the derived ``name`` for every active frame row from its parts.

    Used after an option rename/merge rewrites field cells (the row's name
    embeds the renamed label and would otherwise go stale). Skips the default
    sentinel — its parts are all null so its derived name would be empty, but
    ``FrameRef.name`` requires ``min_length=1``; it keeps its seeded label and is
    resolved by id. Cheap (a few hundred rows), so a full recompute is simpler
    than tracking exactly which rows moved.
    """
    conn.execute(
        f"""
        UPDATE catalog_frame_types
        SET name = {_COMPOSE_NAME_SQL}
        WHERE deleted_at IS NULL AND id <> %(default_id)s
        """,
        {"default_id": APERTURE_DEFAULT_FRAME_ID},
    )


def soft_delete_frame_type(conn: Connection[Any], record_id: str, user_id: UUID) -> bool:
    return soft_delete_catalog_record(conn, table=_TABLE, record_id=record_id, user_id=user_id)


def reactivate_frame_type(conn: Connection[Any], record_id: str, user_id: UUID) -> bool:
    return reactivate_catalog_record(conn, table=_TABLE, record_id=record_id, user_id=user_id)
