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
    request: Request,
) -> None:
    auth_repository.log_action(
        conn,
        action=action,
        user_id=user_id,
        email=access.user.email if access.user else None,
        session_id=None,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
        details={"project_id": str(access.project_id), "version_id": str(version_id)},
    )
