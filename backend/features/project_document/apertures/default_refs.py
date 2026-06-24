"""DB-backed `DefaultsCatalogReader` adapter.

Resolves the seeded ``PHN-Default-Frame`` and ``PHN-Default-Glazing``
catalog rows to ``FrameRef`` / ``GlazingRef`` instances so the
aperture-command dispatcher can bookshelf-copy them into new aperture
elements. Returns ``None`` when the seed row is missing, which the
factory then surfaces as ``aperture_default_refs_missing``.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast

from psycopg import Connection
from psycopg import sql as pgsql

from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    APERTURE_DEFAULT_FRAME_ID,
    APERTURE_DEFAULT_GLAZING_ID,
    CatalogOrigin,
    CatalogTableName,
    FrameRef,
    GlazingRef,
)

_FRAME_COLUMNS = (
    "id",
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
)

_GLAZING_COLUMNS = (
    "id",
    "name",
    "manufacturer",
    "brand",
    "suffix",
    "u_value_w_m2k",
    "g_value",
    "color",
    "source",
    "comments",
)


class DatabaseDefaultsCatalog:
    """`DefaultsCatalogReader` implementation backed by the catalog tables.

    Constructed once per request from the active DB connection. Reads are
    cheap (single-row lookup by primary-key ``id``) so they happen inline
    rather than being cached.
    """

    def __init__(self, conn: Connection[Any]) -> None:
        self._conn = conn

    def get_default_frame(self) -> FrameRef | None:
        row = self._fetch_by_id("catalog_frame_types", _FRAME_COLUMNS, APERTURE_DEFAULT_FRAME_ID)
        if row is None:
            return None
        record_id = str(row.pop("id"))
        return FrameRef.model_validate(
            {
                **{key: row.get(key) for key in _FRAME_COLUMNS if key != "id"},
                "catalog_origin": _origin("frame_types", record_id),
            }
        )

    def get_default_glazing(self) -> GlazingRef | None:
        row = self._fetch_by_id("catalog_glazing_types", _GLAZING_COLUMNS, APERTURE_DEFAULT_GLAZING_ID)
        if row is None:
            return None
        record_id = str(row.pop("id"))
        return GlazingRef.model_validate(
            {
                **{key: row.get(key) for key in _GLAZING_COLUMNS if key != "id"},
                "catalog_origin": _origin("glazing_types", record_id),
            }
        )

    def _fetch_by_id(
        self,
        table: str,
        columns: tuple[str, ...],
        record_id: str,
    ) -> dict[str, Any] | None:
        query = pgsql.SQL("SELECT {columns} FROM {table} WHERE id = %(id)s AND deleted_at IS NULL LIMIT 1").format(
            columns=pgsql.SQL(", ").join(pgsql.Identifier(col) for col in columns),
            table=pgsql.Identifier(table),
        )
        row = self._conn.execute(query, {"id": record_id}).fetchone()
        if row is None:
            return None
        return dict(row)


def _origin(table: str, record_id: str) -> CatalogOrigin:
    return CatalogOrigin(
        catalog_table=cast(CatalogTableName, table),
        catalog_record_id=record_id,
        catalog_schema_version=1,
        synced_at=datetime.now(tz=UTC),
        local_overrides=[],
    )


# Re-export the Protocol so callers only import from this module when
# they want the DB-backed default — keeps the dispatcher import surface
# small.
__all__ = ["DatabaseDefaultsCatalog", "DefaultsCatalogReader"]
