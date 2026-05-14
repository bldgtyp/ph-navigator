"""Raw-SQL repository for the Window-Frame catalog."""

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

_TABLE = "catalog_frame_types"

_SELECT_JOINED = """
SELECT
    cf.id                                  AS id,
    cf.name                                AS name,
    cf.current_version_id                  AS current_version_id,
    cf.created_at                          AS created_at,
    cf.created_by                          AS created_by,
    cf.updated_at                          AS updated_at,
    cf.updated_by                          AS updated_by,
    (cf.deleted_at IS NULL)                AS is_active,
    cfv.catalog_schema_version             AS catalog_schema_version,
    cfv.manufacturer                       AS manufacturer,
    cfv.brand                              AS brand,
    cfv.version_label                      AS version_label,
    cfv.version_date                       AS version_date,
    cfv.width_mm                           AS width_mm,
    cfv.u_value_w_m2k                      AS u_value_w_m2k,
    cfv.psi_g_w_mk                         AS psi_g_w_mk,
    cfv.psi_install_w_mk                   AS psi_install_w_mk,
    cfv.argb_color                         AS argb_color,
    cfv.notes                              AS notes,
    cfv.source_provenance                  AS source_provenance
FROM catalog_frame_types cf
JOIN catalog_frame_type_versions cfv ON cfv.id = cf.current_version_id
"""


def list_frame_types(conn: Connection[Any], include_inactive: bool = False) -> list[dict[str, Any]]:
    where = sql.SQL("") if include_inactive else sql.SQL("WHERE cf.deleted_at IS NULL")
    query = sql.SQL("{select} {where} ORDER BY cf.name ASC, cf.id ASC").format(
        select=sql.SQL(_SELECT_JOINED),
        where=where,
    )
    rows = conn.execute(query).fetchall()
    return list(rows)


def get_frame_type(conn: Connection[Any], record_id: str) -> dict[str, Any] | None:
    query = sql.SQL("{select} WHERE cf.id = %(id)s").format(select=sql.SQL(_SELECT_JOINED))
    return conn.execute(query, {"id": record_id}).fetchone()


def insert_frame_type(
    conn: Connection[Any],
    *,
    record_id: str,
    version_id: str,
    name: str,
    manufacturer: str | None,
    brand: str | None,
    version_label: str,
    version_date: date,
    width_mm: float | None,
    u_value_w_m2k: float | None,
    psi_g_w_mk: float | None,
    psi_install_w_mk: float | None,
    argb_color: str | None,
    notes: str | None,
    source_provenance: str | None,
    user_id: UUID,
) -> None:
    conn.execute(
        """
        INSERT INTO catalog_frame_types (id, name, created_by, updated_by)
        VALUES (%(id)s, %(name)s, %(user_id)s, %(user_id)s)
        """,
        {"id": record_id, "name": name, "user_id": user_id},
    )
    conn.execute(
        """
        INSERT INTO catalog_frame_type_versions (
            id, record_id, version_label, version_date,
            manufacturer, brand,
            width_mm, u_value_w_m2k, psi_g_w_mk, psi_install_w_mk,
            argb_color, notes, source_provenance, created_by
        )
        VALUES (
            %(id)s, %(record_id)s, %(version_label)s, %(version_date)s,
            %(manufacturer)s, %(brand)s,
            %(width_mm)s, %(u_value_w_m2k)s, %(psi_g_w_mk)s, %(psi_install_w_mk)s,
            %(argb_color)s, %(notes)s, %(source_provenance)s, %(user_id)s
        )
        """,
        {
            "id": version_id,
            "record_id": record_id,
            "version_label": version_label,
            "version_date": version_date,
            "manufacturer": manufacturer,
            "brand": brand,
            "width_mm": width_mm,
            "u_value_w_m2k": u_value_w_m2k,
            "psi_g_w_mk": psi_g_w_mk,
            "psi_install_w_mk": psi_install_w_mk,
            "argb_color": argb_color,
            "notes": notes,
            "source_provenance": source_provenance,
            "user_id": user_id,
        },
    )
    conn.execute(
        "UPDATE catalog_frame_types SET current_version_id = %(version_id)s WHERE id = %(id)s",
        {"version_id": version_id, "id": record_id},
    )


_IDENTITY_FIELDS = {"name"}
_VERSION_FIELDS = {
    "manufacturer",
    "brand",
    "version_label",
    "version_date",
    "width_mm",
    "u_value_w_m2k",
    "psi_g_w_mk",
    "psi_install_w_mk",
    "argb_color",
    "notes",
    "source_provenance",
}


def update_frame_type(
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
            UPDATE catalog_frame_types
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
            sql.SQL("UPDATE catalog_frame_type_versions SET {assignments} WHERE id = %(version_id)s").format(
                assignments=assignments
            ),
            version_params,
        )

    return True


def soft_delete_frame_type(conn: Connection[Any], record_id: str, user_id: UUID) -> bool:
    return soft_delete_catalog_record(conn, table=_TABLE, record_id=record_id, user_id=user_id)


def reactivate_frame_type(conn: Connection[Any], record_id: str, user_id: UUID) -> bool:
    return reactivate_catalog_record(conn, table=_TABLE, record_id=record_id, user_id=user_id)
