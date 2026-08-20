"""Project-version metadata workflow rules."""

from __future__ import annotations

from typing import NoReturn
from uuid import UUID

from fastapi import Request
from psycopg.errors import UniqueViolation
from starlette import status

from database import transaction
from features.project_document import repository
from features.project_document.audit import log_document_action
from features.project_document.models import VersionDeleteRequest, VersionPatchRequest
from features.project_document.store import raise_project_version_not_found
from features.projects.access import ProjectAccess, require_editor_user
from features.projects.models import ProjectDetail
from features.projects.service import get_project_detail
from features.shared.errors import api_error


def patch_version(
    version_id: UUID,
    payload: VersionPatchRequest,
    access: ProjectAccess,
    request: Request | None,
) -> ProjectDetail:
    user = require_editor_user(access)
    try:
        with transaction() as conn:
            project, version = repository.lock_project_and_version_for_mutation(
                conn,
                access.project_id,
                version_id,
                include_body=False,
            )
            if project is None:
                raise_project_version_not_found()
            if version is None:
                raise_project_version_not_found()
            repository.patch_version_metadata(
                conn,
                access.project_id,
                version_id,
                user.id,
                payload.name,
                payload.locked,
                make_active=payload.make_active is True,
            )
            fields = payload.model_fields_set
            details: dict[str, object] = {}
            if "name" in fields:
                details.update(old_name=str(version["name"]), new_name=payload.name)
            if "locked" in fields:
                details.update(old_locked=bool(version["locked"]), new_locked=payload.locked)
            if payload.make_active is True:
                details.update(
                    old_active_version_id=str(project["active_version_id"]),
                    new_active_version_id=str(version_id),
                )
            log_document_action(
                conn,
                "project_version_renamed" if fields == {"name"} else "project_version_patch",
                access,
                version_id,
                user.id,
                request,
                extra_details=details,
            )
    except UniqueViolation as exc:
        raise_version_name_taken(exc)

    return get_project_detail(access.project_id, access_mode="editor")


def delete_version(
    version_id: UUID,
    payload: VersionDeleteRequest,
    access: ProjectAccess,
    request: Request | None,
) -> ProjectDetail:
    """Delete one non-active Version after locking the complete Version set."""
    user = require_editor_user(access)
    with transaction() as conn:
        project = repository.lock_project_for_version_mutation(conn, access.project_id)
        if project is None:
            raise_project_version_not_found()
        versions = repository.list_project_versions_for_update(conn, access.project_id)
        version = next((row for row in versions if row["id"] == version_id), None)
        if version is None:
            raise_project_version_not_found()
        if len(versions) == 1:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "last_version_delete_blocked",
                "A project's last Version cannot be deleted.",
            )
        if project["active_version_id"] == version_id:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "active_version_delete_blocked",
                "The default Version cannot be deleted.",
            )
        if payload.confirm_name != version["name"]:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "version_delete_confirmation_mismatch",
                "Version delete confirmation does not match the current name.",
            )

        discarded_draft_count = repository.count_version_drafts(conn, version_id)
        detached_child_count = sum(row["parent_version_id"] == version_id for row in versions)
        if not repository.delete_project_version(conn, access.project_id, version_id):
            raise_project_version_not_found()
        log_document_action(
            conn,
            "project_version_deleted",
            access,
            version_id,
            user.id,
            request,
            extra_details={
                "version_name": str(version["name"]),
                "version_kind": str(version["kind"]),
                "discarded_draft_count": discarded_draft_count,
                "detached_child_count": detached_child_count,
            },
        )

    return get_project_detail(access.project_id, access_mode="editor")


def raise_version_name_taken(exc: UniqueViolation) -> NoReturn:
    """Translate the shared per-project Version-name constraint."""
    if exc.diag.constraint_name != "uq_project_versions_project_name":
        raise exc
    raise api_error(
        status.HTTP_409_CONFLICT,
        "version_name_taken",
        "A version with that name already exists for this project.",
    ) from exc
