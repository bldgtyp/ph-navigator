"""Resolution + envelope logic shared by every GH route.

Handlers stay thin: they declare the access dependency, then call
`resolve_version` / `build_envelope_fields` here. Phases 2–3 plug their payload
serializers into the same two helpers, so version + envelope behavior is
identical across the whole GH surface.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, Request
from psycopg import Connection
from starlette import status

from database import connection
from features.access.principals import ViewerPrincipal
from features.gh_api import repository
from features.gh_api.models import GhProjectInfo, GhResolverResponse, GhVersionInfo
from features.mcp.models import McpScope
from features.mcp.service import authenticate_plaintext_token, project_access_for_token
from features.project_document import repository as document_repository
from features.project_document.document import ProjectDocumentV1
from features.project_document.validation import validate_document
from features.projects.access import ProjectAccess, optional_current_user, project_access_for_user
from features.projects.models import ProjectSummary
from features.projects.service import project_summary
from features.shared.errors import api_error

# GH routes are read-only; a token needs no more than project-read to serve them.
GH_READ_SCOPE: McpScope = "project:read"


@dataclass(frozen=True)
class ResolvedVersion:
    """The saved version a route serves, resolved from `?version=` or the active pointer."""

    version_id: UUID
    last_modified: datetime


def resolve_gh_access(bt_number: str, request: Request) -> ProjectAccess:
    """Three-tier access for the GH router, scoped to this router only.

    Order (PRD §5): session cookie → `Authorization: Bearer phn_mcp_...` →
    anonymous viewer. All three tiers read every GH route today; the bearer seam
    exists so a future per-project "private" flag can require the token with no
    client change. Capability sets in `features/access/capabilities.py` are NOT
    widened — the router authorizes locally.
    """
    with connection() as conn:
        project_row = repository.get_live_project_by_bt_number(conn, bt_number)
    if project_row is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "project_not_found",
            f"No project found for bt_number {bt_number!r}.",
        )
    project = project_summary(project_row)

    user = optional_current_user(request)
    if user is not None:
        return project_access_for_user(user, project, "view")

    bearer = _bearer_token(request)
    if bearer is not None:
        return _access_from_bearer(bearer, project)

    # Anonymous viewer — same read-only posture as `require_project_view_access`.
    return ProjectAccess(project_id=project.id, mode="view", principal=ViewerPrincipal(), project=project)


def resolve_version(access: ProjectAccess, version: UUID | None) -> ResolvedVersion:
    """Resolve the saved version to serve: `?version=` pin, else the active pointer.

    Only rows in `project_versions` are reachable here — drafts live in a
    separate table and are never served (D3). An unknown/foreign version id or a
    project with no saved versions is a 404.
    """
    with connection() as conn:
        return _resolve_version(conn, access, version)


def _resolve_version(conn: Connection[Any], access: ProjectAccess, version: UUID | None) -> ResolvedVersion:
    target = _target_version_id(access, version)
    row = repository.get_saved_version_meta(conn, access.project_id, target)
    if row is None:
        raise _project_version_not_found()
    return ResolvedVersion(version_id=row["id"], last_modified=row["updated_at"])


def resolve_version_and_body(access: ProjectAccess, version: UUID | None) -> tuple[ResolvedVersion, ProjectDocumentV1]:
    """Resolve the saved version and load its validated document body in one read.

    The data routes (Phase 02–03) need both the envelope metadata and the parsed
    document. `project_versions` rows carry both the body and `updated_at`, so a
    single fetch supplies the envelope timestamp and the document — never a draft
    (D3).
    """
    target = _target_version_id(access, version)
    with connection() as conn:
        row = document_repository.get_project_version(conn, access.project_id, target)
    if row is None:
        raise _project_version_not_found()
    resolved = ResolvedVersion(version_id=row["id"], last_modified=row["updated_at"])
    return resolved, validate_document(row["body"])


def _target_version_id(access: ProjectAccess, version: UUID | None) -> UUID:
    target = version if version is not None else access.project.active_version_id
    if target is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "no_saved_versions",
            "This project has no saved versions — save the project in PH-Navigator first.",
        )
    return target


def _project_version_not_found() -> HTTPException:
    return api_error(status.HTTP_404_NOT_FOUND, "project_version_not_found", "Project version not found.")


def build_envelope_fields(access: ProjectAccess, resolved: ResolvedVersion) -> dict[str, Any]:
    """The common envelope kwargs; route models spread these plus their payload keys."""
    return {
        "project": GhProjectInfo(
            bt_number=access.project.bt_number,
            project_id=access.project.id,
            name=access.project.name,
        ),
        "version_id": resolved.version_id,
        "last_modified": resolved.last_modified,
    }


def build_resolver_response(access: ProjectAccess) -> GhResolverResponse:
    """`GET /` — envelope (pinned to the active version) + all saved versions, newest first."""
    with connection() as conn:
        resolved = _resolve_version(conn, access, None)
        version_rows = repository.list_versions_for_project(conn, access.project_id)
    versions = [
        GhVersionInfo(version_id=row["id"], saved_at=row["updated_at"], name=row["name"], kind=row["kind"])
        for row in version_rows
    ]
    return GhResolverResponse(**build_envelope_fields(access, resolved), versions=versions)


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("Authorization")
    if not header:
        return None
    scheme, _, value = header.partition(" ")
    if scheme.lower() != "bearer":
        return None
    token = value.strip()
    return token or None


def _access_from_bearer(bearer: str, project: ProjectSummary) -> ProjectAccess:
    token = authenticate_plaintext_token(bearer)
    if token is None:
        # A client that sent a token wants to know it's bad — do NOT silently
        # fall through to anonymous.
        raise api_error(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_token",
            "Bearer token is invalid, expired, or revoked.",
        )
    try:
        return project_access_for_token(token, project.id, GH_READ_SCOPE)
    except PermissionError:
        # Wrong project or missing scope (mirrors `require_token_scope`).
        raise api_error(status.HTTP_403_FORBIDDEN, "forbidden", "Token is not scoped to this project.") from None
    except LookupError:
        # The project is live and the token is scoped to it, so the only
        # remaining failure is an unresolvable issuing user — treat as unusable.
        raise api_error(status.HTTP_403_FORBIDDEN, "forbidden", "Token cannot be resolved to a user.") from None
