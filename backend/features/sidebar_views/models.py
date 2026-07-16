"""Pydantic envelopes for per-user project-sidebar view-state persistence.

The backend treats `view_state` as an opaque JSON object owned by the frontend
sidebar contract (sort mode, manual order, groups, collapse). Only the envelope
(schema version, object shape, byte size) is validated here — the sibling of
`features/table_views/models.py` for element sidebars.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

SUPPORTED_VIEW_STATE_SCHEMA_VERSION = 1
MAX_VIEW_STATE_BYTES = 65536


class SidebarViewUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    view_state_schema_version: int = Field(ge=1)
    view_state: dict[str, Any]


class SidebarViewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    view_state_schema_version: int
    view_state: dict[str, Any] | None
    updated_at: datetime | None
