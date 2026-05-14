"""Audit helpers for catalog workflows.

Catalogs are the first global mutable surface in V2 — every catalog
write is logged to `user_action_log` per US-OPS-1 and data-model.md §7.3
so we keep a "who changed what when" trail across BLDGTYP projects.
"""

from __future__ import annotations

from typing import Any

from fastapi import Request

from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import client_ip, user_agent


def log_catalog_action(
    conn: Any,
    action: str,
    user: UserPublic,
    request: Request,
    *,
    catalog_table: str,
    record_id: str,
    version_id: str | None = None,
    changed_fields: list[str] | None = None,
) -> None:
    details: dict[str, Any] = {
        "catalog_table": catalog_table,
        "record_id": record_id,
    }
    if version_id is not None:
        details["version_id"] = version_id
    if changed_fields is not None:
        details["changed_fields"] = sorted(changed_fields)
    auth_repository.log_action(
        conn,
        action=action,
        user_id=user.id,
        email=user.email,
        session_id=None,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
        details=details,
    )
