"""Catalog row readers for the drift detector.

``LiveCatalogReader`` opens a short-lived connection per lookup — this
is the v1 implementation shared by the REST route and the MCP tool.
The detector accepts any ``CatalogRowReader``, so tests still pass
in-memory stubs and a future ``BulkCatalogReader`` (PRD §C-03 Step 2)
can pre-fetch the referenced ids once and feed the same protocol.
"""

from __future__ import annotations

from typing import Any

from database import connection
from features.catalogs.frame_types import repository as frame_repo
from features.catalogs.glazing_types import repository as glazing_repo


class LiveCatalogReader:
    """Repository-backed reader: one short-lived connection per lookup."""

    def get_frame_type(self, record_id: str) -> dict[str, Any] | None:
        with connection() as conn:
            return frame_repo.get_frame_type(conn, record_id)

    def get_glazing_type(self, record_id: str) -> dict[str, Any] | None:
        with connection() as conn:
            return glazing_repo.get_glazing_type(conn, record_id)
