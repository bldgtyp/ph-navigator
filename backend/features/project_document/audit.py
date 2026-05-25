"""Audit helpers for project-document workflows."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import Request

from features.auth import repository as auth_repository
from features.auth.service import client_ip, user_agent
from features.projects.access import ProjectAccess


def log_document_action(
    conn: Any,
    action: str,
    access: ProjectAccess,
    version_id: UUID,
    user_id: UUID,
    request: Request | None,
    *,
    extra_details: dict[str, Any] | None = None,
) -> None:
    """Append a project-document audit log row.

    `extra_details` is merged into the per-row `details` payload after
    the base `project_id` / `version_id` keys, so callers can attach
    per-action context (plan-15 P2.2 schema mutations attach the
    `audit_payload` from `apply_schema_mutation`).

    `request` is optional — MCP write tools (plan-15 P2.3) don't have
    a FastAPI `Request` in hand; in that case `ip_address` /
    `user_agent` columns are stored as NULL.
    """
    details: dict[str, Any] = {
        "project_id": str(access.project_id),
        "version_id": str(version_id),
    }
    if extra_details:
        details.update(extra_details)
    auth_repository.log_action(
        conn,
        action=action,
        user_id=user_id,
        email=access.user.email if access.user else None,
        session_id=None,
        ip_address=client_ip(request) if request is not None else None,
        user_agent=user_agent(request) if request is not None else None,
        details=details,
    )
