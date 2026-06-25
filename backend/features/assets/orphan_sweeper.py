"""Orphaned asset cleanup workflow."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from psycopg import Connection

from database import connection, transaction
from features.assets import repository
from features.assets.base import AssetStorage, location_asset_ids_for_project
from features.assets.mapping import asset_row, asset_rows
from features.assets.models import AssetRow
from features.assets.registry import list_asset_references
from features.assets.storage_r2 import orphaned_asset_object_key
from features.project_document import repository as document_repository
from features.project_document.validation import validate_document


class AssetOrphanSweepWorkflow:
    r2: AssetStorage

    def sweep_orphaned_assets(
        self,
        project_id: UUID,
        *,
        dry_run: bool = True,
        pending_max_age_hours: int = 24,
    ) -> dict[str, object]:
        """Move unreferenced/expired assets to the orphan R2 prefix."""

        pending_expired_before = datetime.now(tz=UTC) - timedelta(hours=pending_max_age_hours)
        with connection() as conn:
            candidates = asset_rows(
                repository.list_asset_gc_candidates(
                    conn,
                    project_id,
                    pending_expired_before=pending_expired_before,
                )
            )
            referenced_ids = self._referenced_asset_ids_for_project(conn, project_id)

        results: list[dict[str, object]] = []
        errors: list[dict[str, object]] = []
        for asset in candidates:
            if asset.id in referenced_ids:
                continue
            reason = _gc_reason(asset, pending_expired_before)
            if reason is None:
                continue
            target_key = orphaned_asset_object_key(project_id, asset.id, asset.object_key)
            result: dict[str, object] = {
                "asset_id": asset.id,
                "reason": reason,
                "from": asset.object_key,
                "to": target_key,
            }
            if dry_run:
                results.append(result)
                continue
            try:
                moved_thumbnail_key = self._move_asset_object_to_orphan_prefix(asset, target_key)
                metadata_patch: dict[str, object] = {
                    "orphaned_status": "moved",
                    "orphaned_at": datetime.now(tz=UTC).isoformat(),
                    "orphaned_reason": reason,
                    "original_object_key": asset.object_key,
                }
                if moved_thumbnail_key:
                    metadata_patch["thumbnail_object_key"] = moved_thumbnail_key
                with transaction() as conn:
                    asset_row(
                        repository.mark_asset_orphaned(
                            conn,
                            project_id,
                            asset.id,
                            object_key=target_key,
                            metadata_patch=metadata_patch,
                        )
                    )
                results.append(result)
            except Exception as exc:
                errors.append({"asset_id": asset.id, "reason": reason, "error": str(exc)})
        return {"dry_run": dry_run, "moved": results, "errors": errors}

    def _referenced_asset_ids_for_project(self, conn: Connection[Any], project_id: UUID) -> set[str]:
        referenced: set[str] = set()
        for row in document_repository.list_bodies_for_project(conn, project_id):
            body = validate_document(row["body"])
            referenced.update(str(ref["asset_id"]) for ref in list_asset_references(body))
        referenced.update(location_asset_ids_for_project(conn, project_id))
        return referenced

    def _move_asset_object_to_orphan_prefix(self, asset: AssetRow, target_key: str) -> str | None:
        self.r2.copy_object(asset.object_key, target_key)
        self.r2.delete_object(asset.object_key)
        thumbnail_key = asset.metadata.thumbnail_object_key
        if not thumbnail_key:
            return None
        target_thumbnail_key = target_key.rsplit("/", maxsplit=1)[0] + "/thumb.png"
        self.r2.copy_object(thumbnail_key, target_thumbnail_key)
        self.r2.delete_object(thumbnail_key)
        return target_thumbnail_key


def _gc_reason(asset: AssetRow, pending_expired_before: datetime) -> str | None:
    if asset.object_key.startswith(f"projects/{asset.project_id}/assets/_orphaned/"):
        return None
    if asset.deleted_at is not None:
        return "soft_deleted"
    if asset.upload_status == "failed":
        return "failed_upload"
    if asset.upload_status == "pending" and asset.created_at < pending_expired_before:
        return "expired_pending_upload"
    if asset.upload_status == "uploaded":
        return "unreferenced_upload"
    return None
