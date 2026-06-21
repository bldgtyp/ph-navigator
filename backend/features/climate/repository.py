"""Raw-SQL repository for the app-wide climate reference datasets.

App-scoped, not project-scoped: there is no ``project_id`` here. A
``climate_dataset`` row is one provider/version release; its
``climate_dataset_location`` children each carry a standardized
``ClimateRecord`` in ``data`` (JSONB).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb

_DATASET_SELECT = """
SELECT
    d.id,
    d.provider,
    d.version,
    d.label,
    d.source,
    d.created_at,
    (SELECT count(*) FROM climate_dataset_location l WHERE l.dataset_id = d.id) AS location_count
FROM climate_dataset d
"""

_LOCATION_COLUMNS = """
    id, dataset_id, name, country, region, climate_zone,
    latitude, longitude, elevation_m, station_id
"""


def list_datasets(conn: Connection[Any]) -> list[dict[str, Any]]:
    return list(conn.execute(f"{_DATASET_SELECT} ORDER BY d.provider, d.version").fetchall())


def get_dataset(conn: Connection[Any], dataset_id: UUID) -> dict[str, Any] | None:
    return conn.execute(f"{_DATASET_SELECT} WHERE d.id = %(id)s", {"id": dataset_id}).fetchone()


def get_dataset_by_provider_version(conn: Connection[Any], provider: str, version: str) -> dict[str, Any] | None:
    return conn.execute(
        f"{_DATASET_SELECT} WHERE d.provider = %(provider)s AND d.version = %(version)s",
        {"provider": provider, "version": version},
    ).fetchone()


def get_latest_dataset_for_provider(conn: Connection[Any], provider: str) -> dict[str, Any] | None:
    """Return the most recently seeded dataset for a provider (the pinned release)."""
    return conn.execute(
        f"{_DATASET_SELECT} WHERE d.provider = %(provider)s ORDER BY d.created_at DESC, d.version DESC LIMIT 1",
        {"provider": provider},
    ).fetchone()


def insert_dataset(
    conn: Connection[Any],
    *,
    dataset_id: UUID,
    provider: str,
    version: str,
    label: str | None,
    source: str | None,
) -> None:
    conn.execute(
        """
        INSERT INTO climate_dataset (id, provider, version, label, source)
        VALUES (%(id)s, %(provider)s, %(version)s, %(label)s, %(source)s)
        """,
        {"id": dataset_id, "provider": provider, "version": version, "label": label, "source": source},
    )


def delete_dataset(conn: Connection[Any], dataset_id: UUID) -> None:
    """Remove a dataset and (via ``ON DELETE CASCADE``) its locations."""
    conn.execute("DELETE FROM climate_dataset WHERE id = %(id)s", {"id": dataset_id})


def insert_location(
    conn: Connection[Any],
    *,
    location_id: UUID,
    dataset_id: UUID,
    name: str,
    country: str | None,
    region: str | None,
    climate_zone: str | None,
    latitude: float | None,
    longitude: float | None,
    elevation_m: float | None,
    station_id: str | None,
    data: dict[str, Any],
) -> None:
    conn.execute(
        """
        INSERT INTO climate_dataset_location (
            id, dataset_id, name, country, region, climate_zone,
            latitude, longitude, elevation_m, station_id, data
        )
        VALUES (
            %(id)s, %(dataset_id)s, %(name)s, %(country)s, %(region)s, %(climate_zone)s,
            %(latitude)s, %(longitude)s, %(elevation_m)s, %(station_id)s, %(data)s
        )
        """,
        {
            "id": location_id,
            "dataset_id": dataset_id,
            "name": name,
            "country": country,
            "region": region,
            "climate_zone": climate_zone,
            "latitude": latitude,
            "longitude": longitude,
            "elevation_m": elevation_m,
            "station_id": station_id,
            "data": Jsonb(data),
        },
    )


def count_locations(
    conn: Connection[Any],
    dataset_id: UUID,
    *,
    country: str | None,
    region: str | None,
) -> int:
    row = conn.execute(
        """
        SELECT count(*) AS n
        FROM climate_dataset_location
        WHERE dataset_id = %(dataset_id)s
          AND (%(country)s::text IS NULL OR country = %(country)s::text)
          AND (%(region)s::text IS NULL OR region = %(region)s::text)
        """,
        {"dataset_id": dataset_id, "country": country, "region": region},
    ).fetchone()
    return int(row["n"]) if row else 0


def search_locations(
    conn: Connection[Any],
    dataset_id: UUID,
    *,
    country: str | None,
    region: str | None,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    """List locations filtered by political geography, name-ordered."""
    return list(
        conn.execute(
            f"""
            SELECT {_LOCATION_COLUMNS}
            FROM climate_dataset_location
            WHERE dataset_id = %(dataset_id)s
              AND (%(country)s::text IS NULL OR country = %(country)s::text)
              AND (%(region)s::text IS NULL OR region = %(region)s::text)
            ORDER BY name ASC, id ASC
            LIMIT %(limit)s OFFSET %(offset)s
            """,
            {
                "dataset_id": dataset_id,
                "country": country,
                "region": region,
                "limit": limit,
                "offset": offset,
            },
        ).fetchall()
    )


def nearest_locations(
    conn: Connection[Any],
    dataset_id: UUID,
    *,
    latitude: float,
    longitude: float,
    limit: int,
) -> list[dict[str, Any]]:
    """Return the ``limit`` locations closest to a coordinate.

    Ordering is by squared planar distance with a cos(latitude)
    correction on the longitude term — accurate enough for ranking
    weather stations within a country, and cheap (no PostGIS). Rows with
    null coordinates are excluded.
    """
    return list(
        conn.execute(
            f"""
            SELECT {_LOCATION_COLUMNS}
            FROM climate_dataset_location
            WHERE dataset_id = %(dataset_id)s
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
            ORDER BY
                power(latitude - %(latitude)s, 2)
                + power((longitude - %(longitude)s) * cos(radians(%(latitude)s)), 2) ASC,
                id ASC
            LIMIT %(limit)s
            """,
            {"dataset_id": dataset_id, "latitude": latitude, "longitude": longitude, "limit": limit},
        ).fetchall()
    )


def get_location(conn: Connection[Any], location_id: UUID) -> dict[str, Any] | None:
    """Return one location row including the full ``data`` JSONB record."""
    return conn.execute(
        f"SELECT {_LOCATION_COLUMNS}, data FROM climate_dataset_location WHERE id = %(id)s",
        {"id": location_id},
    ).fetchone()
