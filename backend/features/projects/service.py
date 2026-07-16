"""Project workflow rules."""

from __future__ import annotations

from datetime import date
from typing import Protocol
from uuid import UUID

from fastapi import HTTPException, Request
from psycopg.errors import UniqueViolation
from starlette import status

from config import settings
from database import connection, transaction
from features.assets.storage_r2 import R2Client
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import client_ip, user_agent
from features.project_document.templates import empty_project_document
from features.project_document.validation import enforce_document_body_size
from features.projects import repository
from features.projects.models import (
    AccessMode,
    BtNumberAvailabilityResponse,
    BtNumberConflict,
    CreateProjectRequest,
    ProjectBulkDeleteItem,
    ProjectBulkDeleteRequest,
    ProjectBulkDeleteResponse,
    ProjectDeleteCounts,
    ProjectDeletedListResponse,
    ProjectDeletedSummary,
    ProjectDeleteRequest,
    ProjectDeleteResponse,
    ProjectDetail,
    ProjectHardDeleteRequest,
    ProjectHardDeleteResponse,
    ProjectHardDeleteStorageSummary,
    ProjectListResponse,
    ProjectSummary,
    ProjectVersionPublic,
    UpdateProjectRequest,
)
from features.shared.errors import api_error


class ProjectDeleteObjectsResult(Protocol):
    deleted_object_count: int
    failed_object_keys: list[str]


class ProjectObjectStorage(Protocol):
    def list_object_keys(self, prefix: str) -> list[str]: ...

    def delete_objects(self, object_keys: list[str]) -> ProjectDeleteObjectsResult: ...


def project_summary(row: dict[str, object]) -> ProjectSummary:
    # `display_name` is server-derived, not a DB column, so skip it here — the
    # model's after-validator fills it from `public_alias`/`name`.
    return ProjectSummary.model_validate({field: row[field] for field in ProjectSummary.model_fields if field in row})


def project_delete_counts(row: dict[str, int]) -> ProjectDeleteCounts:
    return ProjectDeleteCounts.model_validate(row)


def project_deleted_summary(row: dict[str, object], counts: ProjectDeleteCounts) -> ProjectDeletedSummary:
    values = {field: row[field] for field in ProjectSummary.model_fields if field in row}
    values.update(
        {
            "deleted_at": row["deleted_at"],
            "deleted_by": row["deleted_by"],
            "hard_delete_after": row["hard_delete_after"],
            "counts": counts,
        }
    )
    return ProjectDeletedSummary.model_validate(values)


def version_public(row: dict[str, object]) -> ProjectVersionPublic:
    return ProjectVersionPublic.model_validate(row)


def list_dashboard_projects(user: UserPublic) -> ProjectListResponse:
    with connection() as conn:
        rows = repository.list_projects_for_owner(conn, user.id)
    return ProjectListResponse(projects=[project_summary(row) for row in rows])


def list_deleted_dashboard_projects(user: UserPublic) -> ProjectDeletedListResponse:
    with connection() as conn:
        rows = repository.list_deleted_projects_for_owner(conn, user.id)
        projects = [
            project_deleted_summary(row, project_delete_counts(repository.count_project_children(conn, row["id"])))
            for row in rows
        ]
    return ProjectDeletedListResponse(projects=projects)


def check_bt_number_available(value: str) -> BtNumberAvailabilityResponse:
    with connection() as conn:
        conflict = repository.get_project_by_bt_number(conn, value.strip())
    if conflict is None:
        return BtNumberAvailabilityResponse(available=True)
    return BtNumberAvailabilityResponse(
        available=False,
        conflict=BtNumberConflict(id=conflict["id"], name=conflict["name"]),
    )


def create_project(payload: CreateProjectRequest, user: UserPublic, request_meta: Request) -> ProjectDetail:
    """Create a project with its v0 working version atomically.

    Single transaction so the ``projects`` row, the seeded
    ``project_versions`` v0 row, and the ``project_create`` audit entry
    either all land or none do. Re-checks ``bt_number`` inside the
    transaction (defence in depth against TOCTOU between the route's
    availability check and the insert) and also catches
    ``UniqueViolation`` raised by the partial unique index — both paths
    raise ``api_error(409, "bt_number_taken", ...)`` with the conflicting
    project's id when known.
    """
    body = empty_project_document(payload)
    serialized_body = enforce_document_body_size(body)
    try:
        with transaction() as conn:
            existing = repository.get_project_by_bt_number(conn, payload.bt_number)
            if existing is not None:
                raise api_error(
                    status.HTTP_409_CONFLICT,
                    "bt_number_taken",
                    "BT number is already assigned to another project.",
                    {"project_id": str(existing["id"]), "name": existing["name"]},
                )
            project = repository.insert_project_with_initial_version(
                conn,
                payload,
                user.id,
                body,
                serialized_body.size_bytes,
                serialized_body=serialized_body,
            )
            auth_repository.log_action(
                conn,
                action="project_create",
                user_id=user.id,
                email=user.email,
                session_id=None,
                ip_address=client_ip(request_meta),
                user_agent=user_agent(request_meta),
                details={"project_id": str(project["id"]), "bt_number": project["bt_number"]},
            )
    except UniqueViolation as exc:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "bt_number_taken",
            "BT number is already assigned to another project.",
        ) from exc

    return get_project_detail(project["id"], access_mode="editor")


def update_project_metadata(
    project_id: UUID,
    payload: UpdateProjectRequest,
    user: UserPublic,
    request_meta: Request,
) -> ProjectDetail:
    """Update mutable project metadata under owner-only authorization.

    Single transaction. Computes the set of actually-changed fields up
    front and short-circuits to a plain read when nothing changed (so a
    no-op PATCH does not write an audit entry). On a ``bt_number``
    change re-checks availability inside the transaction and also
    catches ``UniqueViolation`` on the way out. Raises
    ``api_error(404, "project_not_found")`` for missing rows and
    ``api_error(409, "bt_number_taken")`` for conflicts.
    """
    try:
        with transaction() as conn:
            current_project = repository.get_project_by_id(conn, project_id)
            if current_project is None:
                raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")

            changed_fields = changed_project_metadata_fields(payload, current_project)
            if not changed_fields:
                return get_project_detail(project_id, access_mode="editor")

            if payload.bt_number is not None:
                existing = repository.get_project_by_bt_number(conn, payload.bt_number)
                if existing is not None and existing["id"] != project_id:
                    raise api_error(
                        status.HTTP_409_CONFLICT,
                        "bt_number_taken",
                        "BT number is already assigned to another project.",
                        {"project_id": str(existing["id"]), "name": existing["name"]},
                    )

            project = repository.update_project_metadata(conn, project_id, payload, changed_fields)
            if project is None:
                raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")

            auth_repository.log_action(
                conn,
                action="project_update_metadata",
                user_id=user.id,
                email=user.email,
                session_id=None,
                ip_address=client_ip(request_meta),
                user_agent=user_agent(request_meta),
                details={"project_id": str(project_id), "fields": sorted(changed_fields)},
            )
    except UniqueViolation as exc:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "bt_number_taken",
            "BT number is already assigned to another project.",
        ) from exc

    return get_project_detail(
        project_id,
        access_mode="editor",
        project=project_summary(project),
        owner_display_name=project["owner_display_name"] if isinstance(project["owner_display_name"], str) else None,
    )


def delete_project(
    project_id: UUID,
    payload: ProjectDeleteRequest,
    user: UserPublic,
    request_meta: Request | None,
) -> ProjectDeleteResponse:
    """Soft-delete a project under owner-only authorization.

    Requires explicit ``confirm=True`` in the payload; otherwise raises
    ``api_error(422, "project_delete_confirmation_required")`` before
    touching the DB. Single transaction performs the soft-delete, child
    counts, and audit log; idempotent on already-deleted projects
    (``deleted_at``, ``deleted_by``, and ``hard_delete_after`` are
    preserved via ``COALESCE`` and ``already_deleted=True`` is returned
    so bulk-delete can report per-item state). Raises
    ``api_error(404, "project_not_found")`` for unknown ids and
    ``api_error(403, ...)`` when the caller is not the owner (via
    ``_ensure_project_owner``).
    """
    if not payload.confirm:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "project_delete_confirmation_required",
            "Project delete requires explicit confirmation.",
        )
    with transaction() as conn:
        current = repository.get_project_by_id_including_deleted(conn, project_id)
        if current is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
        _ensure_project_owner(current, user)
        already_deleted = current["deleted_at"] is not None
        deleted = repository.soft_delete_project(conn, project_id, user.id)
        if deleted is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
        counts = project_delete_counts(repository.count_project_children(conn, project_id))
        auth_repository.log_action(
            conn,
            action="project_soft_delete",
            user_id=user.id,
            email=user.email,
            session_id=None,
            ip_address=_client_ip(request_meta),
            user_agent=_user_agent(request_meta),
            details={
                "project_id": str(project_id),
                "bt_number": deleted["bt_number"],
                "name": deleted["name"],
                "already_deleted": already_deleted,
                "hard_delete_after": (
                    deleted["hard_delete_after"].isoformat() if deleted["hard_delete_after"] is not None else None
                ),
                "counts": counts.model_dump(),
            },
        )
    return ProjectDeleteResponse(
        project_id=project_id,
        deleted_at=deleted["deleted_at"],
        hard_delete_after=deleted["hard_delete_after"],
        already_deleted=already_deleted,
        counts=counts,
    )


def bulk_delete_projects(
    payload: ProjectBulkDeleteRequest,
    user: UserPublic,
    request_meta: Request | None,
) -> ProjectBulkDeleteResponse:
    """Soft-delete a batch of projects, reporting per-item success.

    Requires ``confirm=True`` on the envelope. Deduplicates the input
    id list, then delegates each id to ``delete_project`` in its own
    transaction so a failure on one row never rolls back the others.
    Per-item failures (not-found, not-owner, restore-expired) are
    captured into ``ProjectBulkDeleteItem.error_code`` / ``message``;
    the response always has 200 status regardless of how many items
    failed. Never raises after the initial confirmation gate.
    """
    if not payload.confirm:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "project_delete_confirmation_required",
            "Project delete requires explicit confirmation.",
        )
    items: list[ProjectBulkDeleteItem] = []
    seen: set[UUID] = set()
    for project_id in payload.project_ids:
        if project_id in seen:
            continue
        seen.add(project_id)
        try:
            deleted = delete_project(project_id, ProjectDeleteRequest(confirm=True), user, request_meta)
            items.append(
                ProjectBulkDeleteItem(
                    project_id=project_id,
                    ok=True,
                    deleted_at=deleted.deleted_at,
                    hard_delete_after=deleted.hard_delete_after,
                    already_deleted=deleted.already_deleted,
                    counts=deleted.counts,
                )
            )
        except Exception as exc:
            detail = getattr(exc, "detail", None)
            if isinstance(detail, dict):
                items.append(
                    ProjectBulkDeleteItem(
                        project_id=project_id,
                        ok=False,
                        error_code=str(detail.get("error_code", "project_delete_failed")),
                        message=str(detail.get("message", "Project delete failed.")),
                    )
                )
            else:
                items.append(
                    ProjectBulkDeleteItem(
                        project_id=project_id,
                        ok=False,
                        error_code="project_delete_failed",
                        message=str(exc),
                    )
                )
    return ProjectBulkDeleteResponse(items=items)


def restore_project(project_id: UUID, user: UserPublic, request_meta: Request | None) -> ProjectDetail:
    """Restore a soft-deleted project before its hard-delete deadline.

    Single transaction. Idempotent on not-deleted projects (returns the
    current detail). When the row is past ``hard_delete_after``, the
    repository ``restore_project`` returns None and this function raises
    ``api_error(409, "project_restore_expired", ...)`` with the deadline
    in the details. Other failure paths:
    ``api_error(404, "project_not_found")`` for unknown ids,
    ``api_error(403, ...)`` for non-owners.
    """
    with transaction() as conn:
        current = repository.get_project_by_id_including_deleted(conn, project_id)
        if current is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
        _ensure_project_owner(current, user)
        if current["deleted_at"] is None:
            project = project_summary(current)
            owner_display_name = repository.get_owner_display_name(conn, project_id)
            return get_project_detail(
                project_id,
                access_mode="editor",
                project=project,
                owner_display_name=owner_display_name,
            )
        restored = repository.restore_project(conn, project_id)
        if restored is None:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "project_restore_expired",
                "Project can no longer be restored.",
                {"project_id": str(project_id), "hard_delete_after": _isoformat(current["hard_delete_after"])},
            )
        auth_repository.log_action(
            conn,
            action="project_restore",
            user_id=user.id,
            email=user.email,
            session_id=None,
            ip_address=_client_ip(request_meta),
            user_agent=_user_agent(request_meta),
            details={"project_id": str(project_id), "bt_number": restored["bt_number"], "name": restored["name"]},
        )
        owner_display_name = repository.get_owner_display_name(conn, project_id)
    return get_project_detail(
        project_id,
        access_mode="editor",
        project=project_summary(restored),
        owner_display_name=owner_display_name,
    )


def changed_project_metadata_fields(payload: UpdateProjectRequest, current: dict[str, object]) -> set[str]:
    values = payload.model_dump(exclude_unset=True)
    changed: set[str] = set()
    for field, value in values.items():
        current_value = current[field]
        if field == "cert_programs":
            next_programs = value if isinstance(value, list) else []
            current_programs = current_value if isinstance(current_value, list) else []
            if sorted(next_programs) != sorted(current_programs):
                changed.add(field)
        elif value != current_value:
            changed.add(field)
    return changed


def get_project_detail(
    project_id: UUID,
    access_mode: AccessMode,
    project: ProjectSummary | None = None,
    owner_display_name: str | None = None,
    can_view_private_metadata: bool | None = None,
) -> ProjectDetail:
    # Default the private-metadata gate to the editor/viewer binary; the project
    # route overrides it with the precise capability (so a future `certifier`
    # viewer can see private metadata without being an editor).
    if can_view_private_metadata is None:
        can_view_private_metadata = access_mode == "editor"
    with connection() as conn:
        if project is None:
            project_row = repository.get_project_detail_by_id(conn, project_id)
            if project_row is None:
                deleted_row = repository.get_project_by_id_including_deleted(conn, project_id)
                if deleted_row is not None and deleted_row["deleted_at"] is not None:
                    raise project_deleted_error(deleted_row)
                raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
            project = project_summary(project_row)
            owner_display_name = (
                project_row["owner_display_name"] if isinstance(project_row["owner_display_name"], str) else None
            )
        versions = [version_public(row) for row in repository.list_versions_for_project(conn, project_id)]

    active_version = next((version for version in versions if version.id == project.active_version_id), None)
    fields = project.model_dump()
    if not can_view_private_metadata:
        # Redact internal metadata from `client` viewers (keep `phius_number`,
        # `bt_number` public). Ledger §4.9.
        fields["client"] = None
        fields["phius_dropbox_url"] = None
        # The internal `name` may carry identifying info. Once an alias is set,
        # it replaces `name` for `client` viewers so the real name never reaches
        # them (here, not just the frontend — so API/MCP client tokens are
        # covered too). With no alias, the real name flows through unchanged
        # (opt-in privacy). See planning/features/project-public-alias/PRD.md.
        if fields["public_alias"]:
            fields["name"] = fields["public_alias"]
    return ProjectDetail(
        **fields,
        versions=versions,
        active_version=active_version,
        access_mode=access_mode,
        owner_display_name=owner_display_name if access_mode == "editor" else None,
    )


def hard_delete_project(
    project_id: UUID,
    payload: ProjectHardDeleteRequest,
    *,
    user: UserPublic | None = None,
    request_meta: Request | None = None,
    storage: ProjectObjectStorage | None = None,
) -> ProjectHardDeleteResponse:
    """Permanently remove a project and its project-owned object prefix.

    Used only by dev/admin cleanup and MCP's explicitly confirmed
    hard-delete tool — never by normal dashboard routes. Three
    transaction scopes, by design: (1) one to verify the row, confirm
    the name+bt_number match, soft-delete if needed, and read the
    storage manifest while holding the row; (2) external R2 calls
    happen outside any DB transaction; (3) one to either log
    ``project_hard_delete_failed`` and raise (if R2 reported any failed
    keys, leaving DB rows for retry) or delete the rows and log
    ``project_hard_delete``. Raises ``api_error(404, "project_not_found")``,
    ``api_error(422, "project_delete_hard_confirmation_mismatch")``,
    ``api_error(409, "project_hard_delete_storage_partial_failure")``,
    or ``api_error(403, ...)`` from ``_ensure_project_owner``.
    """
    with transaction() as conn:
        current = repository.get_project_by_id_including_deleted(conn, project_id)
        if current is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
        if user is not None:
            _ensure_project_owner(current, user)
        if current["name"] != payload.confirm_project_name or current["bt_number"] != payload.confirm_bt_number:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "project_delete_hard_confirmation_mismatch",
                "Project name and BT number confirmation did not match.",
            )
        if current["deleted_at"] is None:
            current = repository.soft_delete_project(conn, project_id, user.id if user else None)
            if current is None:
                raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
        counts = project_delete_counts(repository.count_project_children(conn, project_id))
        manifest = repository.list_project_storage_manifest(conn, project_id)

    resolved_storage = storage or R2Client(settings)
    object_prefix = f"projects/{project_id}/assets/"
    object_keys = resolved_storage.list_object_keys(object_prefix)
    manifest["prefix"] = object_prefix
    manifest["prefix_object_keys"] = object_keys
    delete_result = resolved_storage.delete_objects(object_keys)
    storage_summary = ProjectHardDeleteStorageSummary(
        deleted_object_count=int(getattr(delete_result, "deleted_object_count", 0)),
        failed_object_keys=list(getattr(delete_result, "failed_object_keys", [])),
    )
    if storage_summary.failed_object_keys:
        with transaction() as conn:
            auth_repository.log_action(
                conn,
                action="project_hard_delete_failed",
                user_id=user.id if user else None,
                email=user.email if user else None,
                session_id=None,
                ip_address=client_ip(request_meta) if request_meta else None,
                user_agent=user_agent(request_meta) if request_meta else None,
                details={
                    "project_id": str(project_id),
                    "bt_number": current["bt_number"],
                    "name": current["name"],
                    "counts": counts.model_dump(),
                    "manifest": manifest,
                    "storage": storage_summary.model_dump(),
                },
            )
        raise api_error(
            status.HTTP_409_CONFLICT,
            "project_hard_delete_storage_partial_failure",
            "Project storage cleanup partially failed; database rows were kept for retry.",
            {"project_id": str(project_id), "storage": storage_summary.model_dump(), "manifest": manifest},
        )

    with transaction() as conn:
        deleted = repository.hard_delete_project_rows(conn, project_id)
        if not deleted:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
        auth_repository.log_action(
            conn,
            action="project_hard_delete",
            user_id=user.id if user else None,
            email=user.email if user else None,
            session_id=None,
            ip_address=client_ip(request_meta) if request_meta else None,
            user_agent=user_agent(request_meta) if request_meta else None,
            details={
                "project_id": str(project_id),
                "bt_number": current["bt_number"],
                "name": current["name"],
                "counts": counts.model_dump(),
                "manifest": manifest,
                "storage": storage_summary.model_dump(),
            },
        )
    return ProjectHardDeleteResponse(
        project_id=project_id,
        deleted=True,
        counts=counts,
        storage=storage_summary,
        manifest=manifest,
    )


def project_deleted_error(row: dict[str, object]) -> HTTPException:
    return api_error(
        status.HTTP_410_GONE,
        "project_deleted",
        "Project was deleted.",
        {
            "recoverability": "restore",
            "project_id": str(row["id"]),
            "deleted_at": _isoformat(row["deleted_at"]),
            "hard_delete_after": _isoformat(row["hard_delete_after"]),
        },
    )


def _ensure_project_owner(project: dict[str, object], user: UserPublic) -> None:
    if project["owner_id"] != user.id:
        raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")


def _isoformat(value: object) -> str | None:
    return value.isoformat() if isinstance(value, date) else None


def _client_ip(request_meta: Request | None) -> str | None:
    return client_ip(request_meta) if request_meta is not None else None


def _user_agent(request_meta: Request | None) -> str | None:
    return user_agent(request_meta) if request_meta is not None else None
