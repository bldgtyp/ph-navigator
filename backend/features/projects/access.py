"""Project access seam — resolves a principal and gates on capabilities.

Every project route resolves a `ProjectAccess` (via `require_project_view_access`
/ `require_project_edit_access`) and then asks `require_capability(access, cap)`
instead of testing raw session presence. `is_editor` survives as a derived
convenience over `PROJECT_EDIT` so existing call sites keep working while route
gates migrate to explicit capabilities incrementally.

Beta behavior is identical to the old binary check: anonymous → `client`
(read-only), any session → `member` (read + write). See
`features/access/capabilities.py` and
`planning/archive/dated/2026-06-27/access-capability-model/PRD.md` §4.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from functools import cached_property
from typing import Literal
from uuid import UUID

from fastapi import HTTPException, Request
from starlette import status

from database import connection
from features.access.capabilities import PROJECT_EDIT, capabilities_for
from features.access.principals import Principal, UserPrincipal, ViewerPrincipal
from features.access.user_capabilities import build_user_principal
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
    principal: Principal
    project: ProjectSummary

    @cached_property
    def capabilities(self) -> frozenset[str]:
        """The principal's capability set, resolved once per access object."""
        return capabilities_for(self.principal)

    @property
    def user(self) -> UserPublic | None:
        return self.principal.user if isinstance(self.principal, UserPrincipal) else None

    @property
    def is_editor(self) -> bool:
        return PROJECT_EDIT in self.capabilities

    def has_capability(self, capability: str) -> bool:
        """Non-raising capability check, for redaction/branching at call sites."""
        return capability in self.capabilities


def optional_current_user(request: Request) -> UserPublic | None:
    try:
        user, _expires_at = current_user_from_request(request)
    except HTTPException:
        return None
    return user


def require_project_access(project_id: UUID, request: Request, mode: ProjectAccessMode) -> ProjectAccess:
    # Resolve the user before opening our own connection: session validation
    # checks out its own pooled connection, so doing it inside the block below
    # would hold two connections at once. Edit mode requires a session and
    # surfaces the precise auth error (expired/invalid); view mode is optional.
    user = current_user_from_request(request)[0] if mode == "edit" else optional_current_user(request)

    with connection() as conn:
        project_row = repository.get_project_by_id_including_deleted(conn, project_id)
        if project_row is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
        if project_row["deleted_at"] is not None:
            raise api_error(
                status.HTTP_410_GONE,
                "project_deleted",
                "Project was deleted.",
                {
                    "recoverability": "restore",
                    "project_id": str(project_id),
                    "deleted_at": _isoformat(project_row["deleted_at"]),
                    "hard_delete_after": _isoformat(project_row["hard_delete_after"]),
                },
            )
        project = ProjectSummary.model_validate(
            {field: project_row[field] for field in ProjectSummary.model_fields if field in project_row}
        )
        principal: Principal = build_user_principal(conn, user) if user is not None else ViewerPrincipal()

    access = ProjectAccess(project_id=project_id, mode=mode, principal=principal, project=project)
    if mode == "edit":
        require_capability(access, PROJECT_EDIT)
    return access


def project_access_for_user(user: UserPublic, project: ProjectSummary, mode: ProjectAccessMode) -> ProjectAccess:
    """Build access for a request already authenticated as ``user``.

    For paths that establish a user outside the FastAPI dependency flow — e.g.
    an MCP bearer token acting as its issuer. Resolves the user's capabilities
    (is_staff + grants) exactly as the request seam does.
    """
    with connection() as conn:
        principal = build_user_principal(conn, user)
    return ProjectAccess(project_id=project.id, mode=mode, principal=principal, project=project)


def require_project_view_access(project_id: UUID, request: Request) -> ProjectAccess:
    return require_project_access(project_id, request, "view")


def require_project_edit_access(project_id: UUID, request: Request) -> ProjectAccess:
    return require_project_access(project_id, request, "edit")


def require_capability(access: ProjectAccess, capability: str) -> None:
    """Raise unless the principal holds ``capability`` on this project.

    Preserves today's error contract: a viewer (no session) that lacks the
    capability gets 401 `not_authenticated`; a signed-in user that lacks it
    gets 403 `forbidden`.
    """
    if capability in access.capabilities:
        return
    if access.user is None:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "not_authenticated", "Sign-in required.")
    raise api_error(status.HTTP_403_FORBIDDEN, "forbidden", "You do not have permission to perform this action.")


def require_editor_user(access: ProjectAccess) -> UserPublic:
    """Require `PROJECT_EDIT` and return the acting user.

    `require_capability` raises (401/403) unless the principal holds
    `PROJECT_EDIT`, and only a `UserPrincipal` can — no audience bundle grants
    it — so reaching the assert means a user principal.
    """
    require_capability(access, PROJECT_EDIT)
    assert isinstance(access.principal, UserPrincipal)
    return access.principal.user


def _isoformat(value: object) -> str | None:
    return value.isoformat() if isinstance(value, date) else None
