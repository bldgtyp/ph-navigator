"""Raw-SQL repository functions for project location metadata."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection, sql
from psycopg.types.json import Jsonb

LOCATION_COLUMNS = """
    project_id, latitude, longitude, elevation_m, time_zone,
    true_north_deg, street_address, city, state, postal_code, county,
    county_fips, country, climate_zone, geodata_provenance, epw_asset_id,
    epw_source_url, created_at, updated_at
"""


def get_location(conn: Connection[Any], project_id: UUID) -> dict[str, Any] | None:
    """Return the saved location row, if the project has one."""
    return conn.execute(
        f"""
        SELECT {LOCATION_COLUMNS}
        FROM project_location
        WHERE project_id = %(project_id)s
        """,
        {"project_id": project_id},
    ).fetchone()


def upsert_location(
    conn: Connection[Any],
    project_id: UUID,
    changed_fields: set[str],
    values: dict[str, object],
) -> dict[str, Any]:
    """Insert or update only the fields explicitly changed by the caller."""
    if not changed_fields:
        existing = get_location(conn, project_id)
        if existing is None:
            raise RuntimeError("Cannot upsert project location without changed fields.")
        return existing

    field_list = sorted(changed_fields)
    insert_columns = ["project_id", *field_list]
    insert_values = [sql.Placeholder("project_id"), *(sql.Placeholder(field) for field in field_list)]
    update_assignments = sql.SQL(", ").join(
        sql.SQL("{} = EXCLUDED.{}").format(sql.Identifier(field), sql.Identifier(field)) for field in field_list
    )
    params = {"project_id": project_id, **{field: _adapt_value(field, values[field]) for field in field_list}}

    row = conn.execute(
        sql.SQL(
            """
            INSERT INTO project_location ({insert_columns})
            VALUES ({insert_values})
            ON CONFLICT (project_id) DO UPDATE
            SET {update_assignments},
                updated_at = now()
            RETURNING {returning_columns}
            """
        ).format(
            insert_columns=sql.SQL(", ").join(sql.Identifier(column) for column in insert_columns),
            insert_values=sql.SQL(", ").join(insert_values),
            update_assignments=update_assignments,
            returning_columns=sql.SQL(LOCATION_COLUMNS),
        ),
        params,
    ).fetchone()
    if row is None:
        raise RuntimeError("Project location upsert did not return a row.")
    return row


def _adapt_value(field: str, value: object) -> object:
    if field == "geodata_provenance":
        return Jsonb(value)
    return value
