"""Forward-compatible project access seam."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from fastapi import HTTPException, Request
from starlette import status

from database import connection
from features.auth.models import UserPublic
from features.auth.service import current_user_from_request
from features.projects import repository
from features.projects.models import ProjectSummary
from features.shared.errors import api_error

ProjectAccessMode = Literal["view", "edit"]


@dataclass(frozen=True)
class ProjectAccess:
    project_id: UUID
    mode: ProjectAccessMode
    user: UserPublic | None
    project: ProjectSummary

    @property
    def is_editor(self) -> bool:
        return self.user is not None


def optional_current_user(request: Request) -> UserPublic | None:
    try:
        user, _expires_at = current_user_from_request(request)
    except HTTPException:
        return None
    return user


def require_project_access(project_id: UUID, request: Request, mode: ProjectAccessMode) -> ProjectAccess:
    with connection() as conn:
        project_row = repository.get_project_by_id(conn, project_id)
    if project_row is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")

    project = ProjectSummary.model_validate(project_row)
    if mode == "edit":
        user, _expires_at = current_user_from_request(request)
        return ProjectAccess(project_id=project_id, mode=mode, user=user, project=project)

    return ProjectAccess(project_id=project_id, mode=mode, user=optional_current_user(request), project=project)


def require_project_view_access(project_id: UUID, request: Request) -> ProjectAccess:
    return require_project_access(project_id, request, "view")


def require_project_edit_access(project_id: UUID, request: Request) -> ProjectAccess:
    return require_project_access(project_id, request, "edit")
