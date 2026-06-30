"""Pydantic envelopes for project-table view-state persistence.

The backend treats `view_state` as an opaque JSON object owned by the
frontend DataTable contract. Only the envelope (schema version, object
shape, byte size) is validated here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

SUPPORTED_VIEW_STATE_SCHEMA_VERSION = 1
MAX_VIEW_STATE_BYTES = 65536


class TableViewUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    view_state_schema_version: int = Field(ge=1)
    view_state: dict[str, Any]


class TableViewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    view_state_schema_version: int
    view_state: dict[str, Any] | None
    updated_at: datetime | None


class BatchTableViewsResponse(BaseModel):
    """Many table-views in one read: `table_key` -> per-key config.

    Each value is a `TableViewResponse` byte-identical to the single-key
    route's output, including the default-empty shape for keys the user
    has not saved. The map carries one entry per *requested* key.
    """

    model_config = ConfigDict(extra="forbid")

    views: dict[str, TableViewResponse]
