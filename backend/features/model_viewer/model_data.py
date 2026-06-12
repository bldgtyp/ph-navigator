"""Upload-time extraction job + `/model_data` artifact serving (D-13/D-15/D-16).

One parse does both jobs: the link-step background task parses the HBJSON
once, writes the geometry-summary columns, and persists the full
`CombinedModelData` JSON to R2 gzip'd under a derived key. `/model_data`
streams that artifact with immutable cache headers — there is no
per-request parse and no in-process model cache (US-VIEW-7 crit. 9 as
amended by D-15).

Error taxonomy (D-16): `ModelParseError` is permanent (the bytes can
never parse; `extraction_status` flips to 'failed' and Retry is hidden);
storage/network failures are transient (status stays 'pending' so the
self-healing read path retries later).
"""

from __future__ import annotations

import gzip
import hashlib
import json
from typing import Any
from uuid import UUID

import structlog
from fastapi import HTTPException, Response
from starlette import status

from database import connection, transaction
from features.assets.service import AssetStorage
from features.model_viewer import repository
from features.model_viewer.extraction import (
    ModelParseError,
    extract_geometry_summary,
    extract_model_data,
    parse_hb_model,
)
from features.projects.access import ProjectAccess
from features.shared.errors import api_error

log = structlog.get_logger(__name__)

_CACHE_CONTROL = "private, max-age=31536000, immutable"


def model_data_object_key(asset_id: str) -> str:
    """Derived-artifact key convention (D-15) — NOT a `project_assets` row."""
    return f"derived/{asset_id}/model_data.json.gz"


def run_extraction_job(storage: AssetStorage, project_id: UUID, file_id: UUID) -> None:
    """Background task scheduled by the link step (D-13).

    Only 'pending' rows are processed: a restored soft-deleted file keeps
    its earlier success/failure (same bytes, same outcome). Transient
    failures leave the row 'pending' — the self-healing `/model_data`
    path is the retry.
    """
    with connection() as conn:
        target = repository.get_extraction_target(conn, project_id, file_id)
    if target is None or target["extraction_status"] != "pending":
        return
    try:
        _extract_and_persist(storage, project_id, file_id, target["asset_id"], target["object_key"])
    except ModelParseError:
        pass  # Row already marked 'failed'; /model_data reports it (D-16).
    except Exception as exc:
        log.warning("model_viewer.extraction.transient_failure", file_id=str(file_id), error=str(exc))


def serve_model_data(
    file_id: UUID,
    access: ProjectAccess,
    storage: AssetStorage,
    if_none_match: str | None = None,
) -> Response:
    """Stream the precomputed artifact with immutable caching (D-15).

    Self-healing: a missing/unreadable artifact on a non-failed row is
    re-extracted synchronously, persisted, and served — this also covers
    rows the background job never reached (e.g. MCP-created links).
    """
    artifact = _load_artifact(file_id, access, storage)
    etag = f'"{hashlib.sha256(artifact).hexdigest()[:32]}"'
    headers = {"Cache-Control": _CACHE_CONTROL, "ETag": etag, "Content-Encoding": "gzip"}
    if if_none_match == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
    return Response(content=artifact, media_type="application/json", headers=headers)


def read_model_data_payload(file_id: UUID, access: ProjectAccess, storage: AssetStorage) -> dict[str, Any]:
    """The artifact as a parsed dict, for callers that aren't HTTP streaming.

    The JSON is returned as-is (already schema-shaped when it was
    written) — re-validating thousands of faces per request would
    re-introduce the per-request parse cost D-15 removed.
    """
    return dict(json.loads(gzip.decompress(_load_artifact(file_id, access, storage))))


def read_model_data_subset(file_id: UUID, access: ProjectAccess, storage: AssetStorage, key: str) -> list[Any]:
    """One section of the artifact, for the per-feature MCP-facing routes."""
    return list(read_model_data_payload(file_id, access, storage)[key])


def _load_artifact(file_id: UUID, access: ProjectAccess, storage: AssetStorage) -> bytes:
    with connection() as conn:
        target = repository.get_extraction_target(conn, access.project_id, file_id)
    if target is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "hbjson_file_not_found", "HBJSON file not found.")
    if target["extraction_status"] == "failed":
        raise _permanent_error(target["extraction_error"])

    if target["extraction_status"] == "success":
        try:
            return storage.get_object(model_data_object_key(target["asset_id"]))
        except Exception as exc:
            log.warning("model_viewer.model_data.artifact_missing", file_id=str(file_id), error=str(exc))

    try:
        return _extract_and_persist(storage, access.project_id, file_id, target["asset_id"], target["object_key"])
    except ModelParseError as exc:
        raise _permanent_error(str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("model_viewer.model_data.transient_failure", file_id=str(file_id), error=str(exc))
        raise api_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "model_data_unavailable",
            "Model data is temporarily unavailable. Try again.",
            {"kind": "transient"},
        ) from exc


def _extract_and_persist(
    storage: AssetStorage,
    project_id: UUID,
    file_id: UUID,
    asset_id: str,
    object_key: str,
) -> bytes:
    """The single extraction pass (D-15): summary columns + R2 artifact.

    Raises `ModelParseError` after marking the row 'failed' (permanent);
    any other exception is transient and leaves the row untouched.
    """
    raw = storage.get_object(object_key)
    try:
        try:
            hbjson = json.loads(raw)
        except ValueError as exc:
            raise ModelParseError(f"Invalid JSON: {exc}") from exc
        model = parse_hb_model(hbjson)
    except ModelParseError as exc:
        with transaction() as conn:
            repository.set_extraction_failed(conn, project_id, file_id, error=str(exc))
        log.warning("model_viewer.extraction.parse_failed", file_id=str(file_id), error=str(exc))
        raise

    data = extract_model_data(model)
    summary = extract_geometry_summary(model)
    # by_alias keeps V1's wire names (`properties.ph._v_sup` etc.);
    # mtime=0 keeps the gzip bytes — and therefore the ETag — deterministic.
    payload = json.dumps(data.model_dump(mode="json", by_alias=True), separators=(",", ":"))
    artifact = gzip.compress(payload.encode(), mtime=0)
    storage.put_object(model_data_object_key(asset_id), artifact, "application/json")
    with transaction() as conn:
        repository.set_extraction_success(
            conn,
            project_id,
            file_id,
            volume_m3=summary.volume_m3,
            envelope_area_m2=summary.envelope_area_m2,
            floor_area_m2=summary.floor_area_m2,
        )
    log.info(
        "model_viewer.extraction.succeeded",
        file_id=str(file_id),
        faces=data.load_summary.faces_extracted,
        spaces=data.load_summary.spaces_extracted,
        air_boundaries_skipped=data.load_summary.air_boundaries_skipped,
    )
    return artifact


def _permanent_error(message: str | None) -> HTTPException:
    return api_error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "model_data_extraction_failed",
        message or "This HBJSON file could not be parsed.",
        {"kind": "permanent"},
    )
