"""Project-version metadata workflow rules."""

from __future__ import annotations

from uuid import UUID

from fastapi import Request
from starlette import status

from database import transaction
from features.project_document import repository
from features.project_document.audit import log_document_action
from features.project_document.models import VersionPatchRequest
from features.project_document.store import raise_project_version_not_found
from features.projects.access import ProjectAccess, require_editor_user
from features.projects.models import ProjectDetail
from features.projects.service import get_project_detail
from features.shared.errors import api_error


def patch_version(
    version_id: UUID,
    payload: VersionPatchRequest,
    access: ProjectAccess,
    request: Request,
) -> ProjectDetail:
    user = require_editor_user(access)
    if payload.locked is None and not payload.make_active:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "validation_error",
            "No version metadata change supplied.",
        )

    with transaction() as conn:
        version = repository.get_project_version_for_update(conn, access.project_id, version_id)
        if version is None:
            raise_project_version_not_found()
        repository.patch_version_metadata(
            conn,
            access.project_id,
            version_id,
            user.id,
            payload.locked,
            make_active=bool(payload.make_active),
        )
        log_document_action(conn, "project_version_patch", access, version_id, user.id, request)

    return get_project_detail(access.project_id, access_mode="editor")
