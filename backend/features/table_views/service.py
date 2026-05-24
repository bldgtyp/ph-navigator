"""Workflow rules for persisting per-user project-table view state."""

from __future__ import annotations

import json
import re
from typing import Any

from starlette import status

from database import connection, transaction
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error
from features.table_views import repository
from features.table_views.models import (
    MAX_VIEW_STATE_BYTES,
    SUPPORTED_VIEW_STATE_SCHEMA_VERSION,
    TableViewResponse,
    TableViewUpsertRequest,
)

_TABLE_KEY_RE = re.compile(r"^[a-z][a-z0-9_]*$")


def validate_table_key(table_key: str) -> None:
    if not _TABLE_KEY_RE.match(table_key):
        raise api_error(
            status.HTTP_400_BAD_REQUEST,
            "invalid_table_key",
            "Table key must match ^[a-z][a-z0-9_]*$.",
            {"table_key": table_key},
        )


def _row_to_response(row: dict[str, Any] | None) -> TableViewResponse:
    if row is None:
        return TableViewResponse(
            view_state_schema_version=SUPPORTED_VIEW_STATE_SCHEMA_VERSION,
            view_state=None,
            updated_at=None,
        )
    return TableViewResponse(
        view_state_schema_version=int(row["view_state_schema_version"]),
        view_state=row["view_state"],
        updated_at=row["updated_at"],
    )


def get_table_view(table_key: str, access: ProjectAccess) -> TableViewResponse:
    user = require_editor_user(access)
    validate_table_key(table_key)
    with connection() as conn:
        row = repository.get(conn, user.id, access.project_id, table_key)
    return _row_to_response(row)


def upsert_table_view(
    table_key: str,
    payload: TableViewUpsertRequest,
    access: ProjectAccess,
) -> TableViewResponse:
    user = require_editor_user(access)
    validate_table_key(table_key)

    if payload.view_state_schema_version != SUPPORTED_VIEW_STATE_SCHEMA_VERSION:
        raise api_error(
            status.HTTP_400_BAD_REQUEST,
            "unsupported_schema_version",
            "Unsupported view_state_schema_version.",
            {
                "supported": SUPPORTED_VIEW_STATE_SCHEMA_VERSION,
                "received": payload.view_state_schema_version,
            },
        )

    serialized = json.dumps(payload.view_state, separators=(",", ":"), ensure_ascii=False)
    size_bytes = len(serialized.encode("utf-8"))
    if size_bytes > MAX_VIEW_STATE_BYTES:
        raise api_error(
            status.HTTP_400_BAD_REQUEST,
            "view_state_too_large",
            "view_state payload exceeds size limit.",
            {"size_bytes": size_bytes, "limit_bytes": MAX_VIEW_STATE_BYTES},
        )

    with transaction() as conn:
        row = repository.upsert(
            conn,
            user.id,
            access.project_id,
            table_key,
            payload.view_state_schema_version,
            payload.view_state,
            size_bytes,
        )
    return _row_to_response(row)


def delete_table_view(table_key: str, access: ProjectAccess) -> None:
    user = require_editor_user(access)
    validate_table_key(table_key)
    with transaction() as conn:
        repository.delete(conn, user.id, access.project_id, table_key)
