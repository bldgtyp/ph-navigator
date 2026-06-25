"""Workflow rules for Model tab HBJSON file management (US-VIEW-1).

File bytes ride the generic asset backbone (upload-intent → signed PUT →
complete-upload). This service owns only the *link step* and the viewer
metadata lifecycle: list, link, rename/notes, soft delete, download URL.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

import structlog
from fastapi import BackgroundTasks
from psycopg.errors import UniqueViolation
from starlette import status

from database import connection, transaction
from features.assets import repository as assets_repository
from features.assets.mapping import asset_row_or_none
from features.assets.models import AssetRow, AssetUrlsResponse
from features.assets.service import AssetService, AssetStorage
from features.model_viewer import model_data, repository
from features.model_viewer.models import (
    HbjsonFileCreateRequest,
    HbjsonFileListResponse,
    HbjsonFilePublic,
    HbjsonFileUpdateRequest,
)
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error

log = structlog.get_logger(__name__)


def hbjson_file_public(row: dict[str, Any]) -> HbjsonFilePublic:
    return HbjsonFilePublic.model_validate(row)


def list_files(access: ProjectAccess) -> HbjsonFileListResponse:
    """Return the newest-first file list for editors or public viewers."""
    with connection() as conn:
        rows = repository.list_hbjson_files(conn, access.project_id)
    return HbjsonFileListResponse(items=[hbjson_file_public(row) for row in rows])


def create_file(
    payload: HbjsonFileCreateRequest,
    access: ProjectAccess,
    *,
    background_tasks: BackgroundTasks | None = None,
    storage: AssetStorage | None = None,
) -> HbjsonFilePublic:
    """Link an uploaded hbjson asset into the viewer file list.

    Content-hash dedup (US-VIEW-1 crit. 3) is two-layer: a SELECT first so
    the 409 can name the existing file for the "[Switch]" affordance, with
    the partial unique index as the race-proof backstop — a concurrent
    duplicate link surfaces as `UniqueViolation` and maps to the same 409.

    Re-linking a soft-deleted file's bytes restores the old row: the asset
    layer dedups uploads by hash, so the same `asset_id` (UNIQUE here
    across live and deleted rows) comes back for a re-upload.

    A successful link schedules the D-13/D-15 extraction job when the
    caller can run background work (REST). MCP links skip it — the row
    stays 'pending' and the self-healing `/model_data` path extracts on
    first read instead.
    """
    user = require_editor_user(access)
    asset: AssetRow | None = None
    duplicate: dict[str, Any] | None = None
    row: dict[str, Any] | None = None
    try:
        with transaction() as conn:
            asset = _validated_hbjson_asset(conn, access, payload.asset_id)
            duplicate = repository.find_active_file_by_content_hash(conn, access.project_id, asset.content_hash_sha256)
            if duplicate is None:
                display_name = payload.display_name or _default_display_name(asset.original_filename)
                deleted = repository.find_deleted_file_by_asset_id(conn, access.project_id, asset.id)
                if deleted is not None:
                    file_id = repository.restore_hbjson_file(
                        conn,
                        project_id=access.project_id,
                        file_id=deleted["id"],
                        display_name=display_name,
                        notes=payload.notes,
                        uploaded_by=user.id,
                    )
                else:
                    file_id = repository.insert_hbjson_file(
                        conn,
                        project_id=access.project_id,
                        asset_id=asset.id,
                        display_name=display_name,
                        notes=payload.notes,
                        uploaded_by=user.id,
                        content_hash_sha256=asset.content_hash_sha256,
                    )
                row = repository.get_hbjson_file(conn, access.project_id, file_id)
    except UniqueViolation:
        if asset is not None:
            with connection() as conn:
                duplicate = repository.find_active_file_by_content_hash(
                    conn, access.project_id, asset.content_hash_sha256
                )

    if duplicate is not None or row is None:
        _discard_orphaned_duplicate_asset(access, user.id, asset, duplicate)
        raise _duplicate_file_error(duplicate)

    log.info("model_viewer.hbjson_file_linked", file_id=str(row["id"]), asset_id=row["asset_id"])
    if background_tasks is not None and storage is not None:
        background_tasks.add_task(model_data.run_extraction_job, storage, access.project_id, row["id"])
    return hbjson_file_public(row)


def update_file(file_id: UUID, payload: HbjsonFileUpdateRequest, access: ProjectAccess) -> HbjsonFilePublic:
    """Rename and/or edit notes on one file row."""
    require_editor_user(access)
    values = payload.model_dump(exclude_unset=True)
    with transaction() as conn:
        if values:
            updated = repository.update_hbjson_file(conn, access.project_id, file_id, values)
            if updated is None:
                raise _file_not_found()
        row = repository.get_hbjson_file(conn, access.project_id, file_id)
    if row is None:
        raise _file_not_found()
    return hbjson_file_public(row)


def delete_file(file_id: UUID, access: ProjectAccess) -> None:
    """Soft-delete a file row; R2 cleanup follows the asset GC policy.

    The underlying asset row stays live so the dedup-by-hash flow can
    restore this file if the same bytes are re-uploaded later.
    """
    require_editor_user(access)
    with transaction() as conn:
        deleted = repository.soft_delete_hbjson_file(conn, access.project_id, file_id)
        # US-ENV-14 (FUTURE): clear project_airtightness.hbjson_file_id here
        # when that table exists.
    if not deleted:
        raise _file_not_found()
    log.info("model_viewer.hbjson_file_deleted", file_id=str(file_id))


def get_download_urls(file_id: UUID, access: ProjectAccess, asset_service: AssetService) -> AssetUrlsResponse:
    """Resolve signed URLs for one file via the asset backbone.

    Being linked to a live hbjson row *is* this surface's reference check:
    hbjson assets are never referenced by the project document, so the
    asset layer's anonymous-viewer reference gate would always 403 — it is
    bypassed deliberately.
    """
    with connection() as conn:
        row = repository.get_hbjson_file(conn, access.project_id, file_id)
    if row is None:
        raise _file_not_found()
    return asset_service.get_asset_urls(access, row["asset_id"], require_reference_for_anonymous=False)


def _validated_hbjson_asset(conn: Any, access: ProjectAccess, asset_id: str) -> AssetRow:
    asset_row = assets_repository.get_asset_by_id(conn, access.project_id, asset_id)
    asset = asset_row_or_none(asset_row)
    if asset is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "hbjson_asset_not_found", "Uploaded asset not found.")
    if asset.asset_kind != "hbjson":
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "hbjson_asset_kind_invalid",
            "Asset is not an HBJSON upload.",
        )
    if asset.upload_status != "uploaded":
        raise api_error(status.HTTP_409_CONFLICT, "asset_upload_incomplete", "Asset upload is not complete.")
    return asset


def _discard_orphaned_duplicate_asset(
    access: ProjectAccess,
    user_id: UUID,
    asset: AssetRow | None,
    duplicate: dict[str, Any] | None,
) -> None:
    """Soft-delete a rejected duplicate's asset so R2 GC reclaims it.

    Usually a no-op: the asset layer dedups uploads by hash, so the
    rejected link normally points at the *same* asset the existing file
    row holds — which must stay. Only a genuinely distinct asset (e.g.
    two intents raced) is discarded.
    """
    if asset is None or (duplicate is not None and duplicate["asset_id"] == asset.id):
        return
    with transaction() as conn:
        assets_repository.soft_delete_asset(conn, access.project_id, asset.id, deleted_by=user_id)


def _duplicate_file_error(duplicate: dict[str, Any] | None):
    details: dict[str, object] = {}
    if duplicate is not None:
        details = {"id": str(duplicate["id"]), "display_name": duplicate["display_name"]}
    return api_error(
        status.HTTP_409_CONFLICT,
        "hbjson_duplicate_file",
        "This file matches an existing upload.",
        details,
    )


def _file_not_found():
    return api_error(status.HTTP_404_NOT_FOUND, "hbjson_file_not_found", "HBJSON file not found.")


def _default_display_name(original_filename: str) -> str:
    """US-VIEW-1 crit. 3: default display name = filename minus extension."""
    stem, dot, _ext = original_filename.rpartition(".")
    return stem if dot else original_filename
