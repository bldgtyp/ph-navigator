"""Workflow rules for project-level location metadata."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import Request

from database import connection, transaction
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import client_ip, user_agent
from features.project_location import repository
from features.project_location.models import (
    ProjectLocation,
    ProjectLocationUpdateResponse,
    UpdateProjectLocationRequest,
)


def get_project_location(project_id: UUID) -> ProjectLocation:
    """Read a project's location, synthesizing the initial unset shape."""
    with connection() as conn:
        row = repository.get_location(conn, project_id)
    return project_location_from_row(row)


def update_project_location(
    project_id: UUID,
    payload: UpdateProjectLocationRequest,
    user: UserPublic,
    request_meta: Request | None,
) -> ProjectLocationUpdateResponse:
    """Apply a partial location update without touching versioned project JSON."""
    values = payload.model_dump(exclude_unset=True)
    with transaction() as conn:
        current = repository.get_location(conn, project_id)
        changed_fields = changed_location_fields(values, current)
        if changed_fields:
            row = repository.upsert_location(conn, project_id, changed_fields, values)
            auth_repository.log_action(
                conn,
                action="project_location_update",
                user_id=user.id,
                email=user.email,
                session_id=None,
                ip_address=client_ip(request_meta) if request_meta else None,
                user_agent=user_agent(request_meta) if request_meta else None,
                details={"project_id": str(project_id), "fields": sorted(changed_fields)},
            )
        else:
            row = current

    return ProjectLocationUpdateResponse(location=project_location_from_row(row), warnings=[])


def changed_location_fields(values: dict[str, object], current: dict[str, Any] | None) -> set[str]:
    """Return payload fields whose value differs from the persisted row."""
    if current is None:
        return set(values)
    changed: set[str] = set()
    for field, value in values.items():
        if current[field] != value:
            changed.add(field)
    return changed


def project_location_from_row(row: dict[str, Any] | None) -> ProjectLocation:
    """Convert the optional persistence row into the stable API shape."""
    if row is None:
        return ProjectLocation(is_set=False, updated_at=None, epw=None)

    values = {field: row[field] for field in UpdateProjectLocationRequest.model_fields}
    return ProjectLocation.model_validate(
        {
            **values,
            "is_set": True,
            "updated_at": row["updated_at"],
            "epw": None,
        }
    )
