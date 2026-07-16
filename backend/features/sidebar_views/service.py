"""Workflow rules for persisting per-user project-sidebar view state."""

from __future__ import annotations

import json
import re
from typing import Any

from starlette import status

from database import connection, transaction
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error
from features.sidebar_views import repository
from features.sidebar_views.models import (
    MAX_VIEW_STATE_BYTES,
    SUPPORTED_VIEW_STATE_SCHEMA_VERSION,
    SidebarViewResponse,
    SidebarViewUpsertRequest,
)

_VIEW_KEY_RE = re.compile(r"^[a-z][a-z0-9_]*$")


def validate_view_key(view_key: str) -> None:
    if not _VIEW_KEY_RE.match(view_key):
        raise api_error(
            status.HTTP_400_BAD_REQUEST,
            "invalid_view_key",
            "Sidebar view key must match ^[a-z][a-z0-9_]*$.",
            {"view_key": view_key},
        )


def _row_to_response(row: dict[str, Any] | None) -> SidebarViewResponse:
    if row is None:
        return SidebarViewResponse(
            view_state_schema_version=SUPPORTED_VIEW_STATE_SCHEMA_VERSION,
            view_state=None,
            updated_at=None,
        )
    return SidebarViewResponse(
        view_state_schema_version=int(row["view_state_schema_version"]),
        view_state=row["view_state"],
        updated_at=row["updated_at"],
    )


def get_sidebar_view(view_key: str, access: ProjectAccess) -> SidebarViewResponse:
    user = require_editor_user(access)
    validate_view_key(view_key)
    with connection() as conn:
        row = repository.get(conn, user.id, access.project_id, view_key)
    return _row_to_response(row)


def upsert_sidebar_view(
    view_key: str,
    payload: SidebarViewUpsertRequest,
    access: ProjectAccess,
) -> SidebarViewResponse:
    user = require_editor_user(access)
    validate_view_key(view_key)

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
            view_key,
            payload.view_state_schema_version,
            payload.view_state,
            size_bytes,
        )
    return _row_to_response(row)


def delete_sidebar_view(view_key: str, access: ProjectAccess) -> None:
    user = require_editor_user(access)
    validate_view_key(view_key)
    with transaction() as conn:
        repository.delete(conn, user.id, access.project_id, view_key)
