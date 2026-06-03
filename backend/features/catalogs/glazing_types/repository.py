"""Raw-SQL repository for the Window-Glazing catalog."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import date
from typing import Any
from uuid import UUID

from psycopg import Connection, sql

from features.catalogs._shared import (
    reactivate_catalog_record,
    soft_delete_catalog_record,
)

_TABLE = "catalog_glazing_types"

_SELECT_JOINED = """
SELECT
    cg.id                                  AS id,
    cg.name                                AS name,
    cg.current_version_id                  AS current_version_id,
    cg.created_at                          AS created_at,
    cg.created_by                          AS created_by,
    cg.updated_at                          AS updated_at,
    cg.updated_by                          AS updated_by,
    (cg.deleted_at IS NULL)                AS is_active,
    cgv.catalog_schema_version             AS catalog_schema_version,
    cgv.manufacturer                       AS manufacturer,
    cgv.brand                              AS brand,
    cgv.version_label                      AS version_label,
    cgv.version_date                       AS version_date,
    cgv.u_value_w_m2k                      AS u_value_w_m2k,
    cgv.g_value                            AS g_value,
    cgv.color                         AS color,
    cgv.notes                              AS notes,
    cgv.source_provenance                  AS source_provenance
FROM catalog_glazing_types cg
JOIN catalog_glazing_type_versions cgv ON cgv.id = cg.current_version_id
"""


def list_glazing_types(conn: Connection[Any], include_inactive: bool = False) -> list[dict[str, Any]]:
    where = sql.SQL("") if include_inactive else sql.SQL("WHERE cg.deleted_at IS NULL")
    query = sql.SQL("{select} {where} ORDER BY cg.name ASC, cg.id ASC").format(
        select=sql.SQL(_SELECT_JOINED),
        where=where,
    )
    rows = conn.execute(query).fetchall()
    return list(rows)


def get_glazing_type(conn: Connection[Any], record_id: str) -> dict[str, Any] | None:
    query = sql.SQL("{select} WHERE cg.id = %(id)s").format(select=sql.SQL(_SELECT_JOINED))
    return conn.execute(query, {"id": record_id}).fetchone()


def insert_glazing_type(
    conn: Connection[Any],
    *,
    record_id: str,
    version_id: str,
    name: str,
    manufacturer: str | None,
    brand: str | None,
    version_label: str,
    version_date: date,
    u_value_w_m2k: float | None,
    g_value: float | None,
    color: str | None,
    notes: str | None,
    source_provenance: str | None,
    user_id: UUID,
) -> None:
    conn.execute(
        """
        INSERT INTO catalog_glazing_types (id, name, created_by, updated_by)
        VALUES (%(id)s, %(name)s, %(user_id)s, %(user_id)s)
        """,
        {"id": record_id, "name": name, "user_id": user_id},
    )
    conn.execute(
        """
        INSERT INTO catalog_glazing_type_versions (
            id, record_id, version_label, version_date,
            manufacturer, brand,
            u_value_w_m2k, g_value,
            color, notes, source_provenance, created_by
        )
        VALUES (
            %(id)s, %(record_id)s, %(version_label)s, %(version_date)s,
            %(manufacturer)s, %(brand)s,
            %(u_value_w_m2k)s, %(g_value)s,
            %(color)s, %(notes)s, %(source_provenance)s, %(user_id)s
        )
        """,
        {
            "id": version_id,
            "record_id": record_id,
            "version_label": version_label,
            "version_date": version_date,
            "manufacturer": manufacturer,
            "brand": brand,
            "u_value_w_m2k": u_value_w_m2k,
            "g_value": g_value,
            "color": color,
            "notes": notes,
            "source_provenance": source_provenance,
            "user_id": user_id,
        },
    )
    conn.execute(
        "UPDATE catalog_glazing_types SET current_version_id = %(version_id)s WHERE id = %(id)s",
        {"version_id": version_id, "id": record_id},
    )


_IDENTITY_FIELDS = {"name"}
_VERSION_FIELDS = {
    "manufacturer",
    "brand",
    "version_label",
    "version_date",
    "u_value_w_m2k",
    "g_value",
    "color",
    "notes",
    "source_provenance",
}


def update_glazing_type(
    conn: Connection[Any],
    record_id: str,
    values: Mapping[str, object],
    user_id: UUID,
) -> bool:
    identity_updates = {k: v for k, v in values.items() if k in _IDENTITY_FIELDS}
    version_updates = {k: v for k, v in values.items() if k in _VERSION_FIELDS}

    identity_assignments_parts: list[sql.Composable] = [
        sql.SQL("{} = {}").format(sql.Identifier(key), sql.Placeholder(key)) for key in sorted(identity_updates)
    ]
    identity_assignments_parts.append(sql.SQL("updated_at = now()"))
    identity_assignments_parts.append(sql.SQL("updated_by = %(updated_by)s"))
    params: dict[str, Any] = dict(identity_updates)
    params["updated_by"] = user_id
    params["id"] = record_id
    row = conn.execute(
        sql.SQL(
            """
            UPDATE catalog_glazing_types
            SET {assignments}
            WHERE id = %(id)s AND deleted_at IS NULL
            RETURNING current_version_id
            """
        ).format(assignments=sql.SQL(", ").join(identity_assignments_parts)),
        params,
    ).fetchone()
    if row is None:
        return False

    if version_updates:
        assignments = sql.SQL(", ").join(
            sql.SQL("{} = {}").format(sql.Identifier(key), sql.Placeholder(key)) for key in sorted(version_updates)
        )
        version_params: dict[str, Any] = dict(version_updates)
        version_params["version_id"] = row["current_version_id"]
        conn.execute(
            sql.SQL("UPDATE catalog_glazing_type_versions SET {assignments} WHERE id = %(version_id)s").format(
                assignments=assignments
            ),
            version_params,
        )

    return True


def soft_delete_glazing_type(conn: Connection[Any], record_id: str, user_id: UUID) -> bool:
    return soft_delete_catalog_record(conn, table=_TABLE, record_id=record_id, user_id=user_id)


def reactivate_glazing_type(conn: Connection[Any], record_id: str, user_id: UUID) -> bool:
    return reactivate_catalog_record(conn, table=_TABLE, record_id=record_id, user_id=user_id)
