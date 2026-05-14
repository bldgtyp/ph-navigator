"""Raw-SQL repository for the Materials catalog."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import date
from typing import Any
from uuid import UUID

from psycopg import Connection, sql

_SELECT_JOINED = """
SELECT
    cm.id                                  AS id,
    cm.name                                AS name,
    cm.category                            AS category,
    cm.current_version_id                  AS current_version_id,
    cm.created_at                          AS created_at,
    cm.created_by                          AS created_by,
    cm.updated_at                          AS updated_at,
    cm.updated_by                          AS updated_by,
    (cm.deleted_at IS NULL)                AS is_active,
    cmv.catalog_schema_version             AS catalog_schema_version,
    cmv.version_label                      AS version_label,
    cmv.version_date                       AS version_date,
    cmv.conductivity_w_mk                  AS conductivity_w_mk,
    cmv.density_kg_m3                      AS density_kg_m3,
    cmv.specific_heat_j_kgk                AS specific_heat_j_kgk,
    cmv.emissivity                         AS emissivity,
    cmv.argb_color                         AS argb_color,
    cmv.notes                              AS notes,
    cmv.source_provenance                  AS source_provenance
FROM catalog_materials cm
JOIN catalog_material_versions cmv ON cmv.id = cm.current_version_id
"""


def list_materials(conn: Connection[Any], include_inactive: bool = False) -> list[dict[str, Any]]:
    where = sql.SQL("") if include_inactive else sql.SQL("WHERE cm.deleted_at IS NULL")
    query = sql.SQL("{select} {where} ORDER BY cm.name ASC, cm.id ASC").format(
        select=sql.SQL(_SELECT_JOINED),
        where=where,
    )
    rows = conn.execute(query).fetchall()
    return list(rows)


def get_material(conn: Connection[Any], material_id: str) -> dict[str, Any] | None:
    query = sql.SQL("{select} WHERE cm.id = %(id)s").format(select=sql.SQL(_SELECT_JOINED))
    return conn.execute(query, {"id": material_id}).fetchone()


def insert_material(
    conn: Connection[Any],
    *,
    record_id: str,
    version_id: str,
    name: str,
    category: str,
    version_label: str,
    version_date: date,
    conductivity_w_mk: float | None,
    density_kg_m3: float | None,
    specific_heat_j_kgk: float | None,
    emissivity: float | None,
    argb_color: str | None,
    notes: str | None,
    source_provenance: str | None,
    user_id: UUID,
) -> None:
    conn.execute(
        """
        INSERT INTO catalog_materials (id, name, category, created_by, updated_by)
        VALUES (%(id)s, %(name)s, %(category)s, %(user_id)s, %(user_id)s)
        """,
        {"id": record_id, "name": name, "category": category, "user_id": user_id},
    )
    conn.execute(
        """
        INSERT INTO catalog_material_versions (
            id, record_id, version_label, version_date,
            conductivity_w_mk, density_kg_m3, specific_heat_j_kgk, emissivity,
            argb_color, notes, source_provenance, created_by
        )
        VALUES (
            %(id)s, %(record_id)s, %(version_label)s, %(version_date)s,
            %(conductivity_w_mk)s, %(density_kg_m3)s, %(specific_heat_j_kgk)s, %(emissivity)s,
            %(argb_color)s, %(notes)s, %(source_provenance)s, %(user_id)s
        )
        """,
        {
            "id": version_id,
            "record_id": record_id,
            "version_label": version_label,
            "version_date": version_date,
            "conductivity_w_mk": conductivity_w_mk,
            "density_kg_m3": density_kg_m3,
            "specific_heat_j_kgk": specific_heat_j_kgk,
            "emissivity": emissivity,
            "argb_color": argb_color,
            "notes": notes,
            "source_provenance": source_provenance,
            "user_id": user_id,
        },
    )
    conn.execute(
        "UPDATE catalog_materials SET current_version_id = %(version_id)s WHERE id = %(id)s",
        {"version_id": version_id, "id": record_id},
    )


_IDENTITY_FIELDS = {"name", "category"}
_VERSION_FIELDS = {
    "version_label",
    "version_date",
    "conductivity_w_mk",
    "density_kg_m3",
    "specific_heat_j_kgk",
    "emissivity",
    "argb_color",
    "notes",
    "source_provenance",
}


def update_material(
    conn: Connection[Any],
    material_id: str,
    values: Mapping[str, object],
    user_id: UUID,
) -> bool:
    """Patch the identity row and the current version in place. Returns False if not found or already deactivated."""
    identity_updates = {k: v for k, v in values.items() if k in _IDENTITY_FIELDS}
    version_updates = {k: v for k, v in values.items() if k in _VERSION_FIELDS}

    # Single UPDATE on the identity row both gates existence/active state
    # (via WHERE deleted_at IS NULL) and returns the version id we need for
    # the version-row UPDATE. Always touches updated_at/by so the joined row
    # reflects the latest edit even when only version fields changed.
    identity_assignments_parts: list[sql.Composable] = [
        sql.SQL("{} = {}").format(sql.Identifier(key), sql.Placeholder(key)) for key in sorted(identity_updates)
    ]
    identity_assignments_parts.append(sql.SQL("updated_at = now()"))
    identity_assignments_parts.append(sql.SQL("updated_by = %(updated_by)s"))
    params: dict[str, Any] = dict(identity_updates)
    params["updated_by"] = user_id
    params["id"] = material_id
    row = conn.execute(
        sql.SQL(
            """
            UPDATE catalog_materials
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
            sql.SQL("UPDATE catalog_material_versions SET {assignments} WHERE id = %(version_id)s").format(
                assignments=assignments
            ),
            version_params,
        )

    return True


def soft_delete_material(conn: Connection[Any], material_id: str, user_id: UUID) -> bool:
    row = conn.execute(
        """
        UPDATE catalog_materials
        SET deleted_at = now(),
            updated_at = now(),
            updated_by = %(user_id)s
        WHERE id = %(id)s AND deleted_at IS NULL
        RETURNING id
        """,
        {"id": material_id, "user_id": user_id},
    ).fetchone()
    return row is not None


def reactivate_material(conn: Connection[Any], material_id: str, user_id: UUID) -> bool:
    row = conn.execute(
        """
        UPDATE catalog_materials
        SET deleted_at = NULL,
            updated_at = now(),
            updated_by = %(user_id)s
        WHERE id = %(id)s AND deleted_at IS NOT NULL
        RETURNING id
        """,
        {"id": material_id, "user_id": user_id},
    ).fetchone()
    return row is not None
