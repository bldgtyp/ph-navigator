"""Window-Frame catalog API routes."""

from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Query, Request
from starlette import status

from features.auth.routes import CurrentUser
from features.catalogs._shared import CatalogManufacturerListResponse
from features.catalogs.frame_types.import_export.service import (
    CommitRequest,
    CommitResponse,
    PreviewResponse,
    commit_import,
    preview_import,
)
from features.catalogs.frame_types.models import (
    CatalogFieldOptionsResponse,
    CatalogFrameTypeCreateRequest,
    CatalogFrameTypeListResponse,
    CatalogFrameTypeOptionsResponse,
    CatalogFrameTypePublic,
    CatalogFrameTypeUpdateRequest,
    EditCatalogOptionsRequest,
)
from features.catalogs.frame_types.options_service import (
    edit_frame_type_options,
    list_frame_type_options,
)
from features.catalogs.frame_types.service import (
    create_frame_type,
    deactivate_frame_type,
    duplicate_frame_type,
    get_frame_type,
    list_frame_manufacturers,
    list_frame_types,
    reactivate_frame_type,
    update_frame_type,
)
from features.shared.errors import api_error

# 8 MB cap — same rationale as Materials / Glazing. The 189-row AirTable
# seed is ~80 KB so the limit is purely DOS protection.
_IMPORT_MAX_BYTES: int = 8 * 1024 * 1024

router = APIRouter(prefix="/api/v1/catalogs/frame-types", tags=["catalogs"])


@router.get("", response_model=CatalogFrameTypeListResponse)
def get_frame_types(
    auth: CurrentUser,
    include_inactive: Annotated[bool, Query()] = False,
    location: Annotated[str | None, Query(max_length=40)] = None,
    operation: Annotated[str | None, Query(max_length=40)] = None,
    use: Annotated[str | None, Query(max_length=40)] = None,
    manufacturers: Annotated[list[str] | None, Query()] = None,
) -> CatalogFrameTypeListResponse:
    """List catalog frame types with optional Phase 06 filters.

    ``location``, ``operation``, and ``use`` filter case-insensitively on
    the corresponding column; ``manufacturers`` accepts a repeated query
    param (e.g. ``?manufacturers=ABC&manufacturers=XYZ``) and matches any
    of the supplied names. Filters compose with AND.
    """

    del auth
    return list_frame_types(
        include_inactive=include_inactive,
        location=location,
        operation=operation,
        use=use,
        manufacturers=manufacturers,
    )


@router.post("", response_model=CatalogFrameTypePublic, status_code=status.HTTP_201_CREATED)
def post_frame_type(
    payload: CatalogFrameTypeCreateRequest, request: Request, auth: CurrentUser
) -> CatalogFrameTypePublic:
    user, _expires_at = auth
    return create_frame_type(payload, user, request)


@router.get("/manufacturers", response_model=CatalogManufacturerListResponse)
def get_frame_manufacturers(auth: CurrentUser) -> CatalogManufacturerListResponse:
    """Phase 11 manufacturer roster — distinct manufacturer names + counts."""

    del auth
    return list_frame_manufacturers()


# NOTE: `/options` must be declared before `/{record_id}` so it is not matched
# as a record id (Starlette resolves routes in declaration order).
@router.get("/options", response_model=CatalogFrameTypeOptionsResponse)
def get_frame_type_options(auth: CurrentUser) -> CatalogFrameTypeOptionsResponse:
    """All six single-select fields' option lists (the dropdown vocabularies)."""

    del auth
    return list_frame_type_options()


@router.put("/options", response_model=CatalogFieldOptionsResponse)
def put_frame_type_options(
    payload: EditCatalogOptionsRequest, request: Request, auth: CurrentUser
) -> CatalogFieldOptionsResponse:
    """Full-replace one field's option list (add / rename / reorder / merge)."""

    user, _expires_at = auth
    return edit_frame_type_options(payload, user, request)


@router.get("/{record_id}", response_model=CatalogFrameTypePublic)
def get_one_frame_type(record_id: str, auth: CurrentUser) -> CatalogFrameTypePublic:
    del auth
    return get_frame_type(record_id)


@router.patch("/{record_id}", response_model=CatalogFrameTypePublic)
def patch_frame_type(
    record_id: str,
    payload: CatalogFrameTypeUpdateRequest,
    request: Request,
    auth: CurrentUser,
) -> CatalogFrameTypePublic:
    user, _expires_at = auth
    return update_frame_type(record_id, payload, user, request)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_frame_type_route(record_id: str, request: Request, auth: CurrentUser) -> None:
    user, _expires_at = auth
    deactivate_frame_type(record_id, user, request)


@router.post("/{record_id}/reactivate", response_model=CatalogFrameTypePublic)
def reactivate_frame_type_route(record_id: str, request: Request, auth: CurrentUser) -> CatalogFrameTypePublic:
    user, _expires_at = auth
    return reactivate_frame_type(record_id, user, request)


@router.post(
    "/{record_id}/duplicate",
    response_model=CatalogFrameTypePublic,
    status_code=status.HTTP_201_CREATED,
)
def post_frame_type_duplicate(
    record_id: str,
    request: Request,
    auth: CurrentUser,
) -> CatalogFrameTypePublic:
    user, _expires_at = auth
    return duplicate_frame_type(record_id, user, request)


@router.post("/import/preview", response_model=PreviewResponse)
async def post_import_preview(
    request: Request,
    auth: CurrentUser,
) -> PreviewResponse:
    """Dry-run an import: parse, upgrade, coerce, dedup, return a report."""
    body_bytes = await _read_body_with_limit(request)
    try:
        payload = json.loads(body_bytes)
    except json.JSONDecodeError as exc:
        raise api_error(
            status.HTTP_400_BAD_REQUEST,
            "catalog_import_bad_json",
            f"Import body is not valid JSON: {exc.msg}",
        ) from exc
    if not isinstance(payload, dict):
        raise api_error(
            status.HTTP_400_BAD_REQUEST,
            "catalog_import_bad_envelope",
            "Import body must be a JSON object.",
        )
    user, _expires_at = auth
    return preview_import(payload, user)


@router.post("/import/commit", response_model=CommitResponse)
def post_import_commit(
    payload: CommitRequest,
    request: Request,
    auth: CurrentUser,
) -> CommitResponse:
    """Insert the rows cached under a preview token (single transaction)."""
    user, _expires_at = auth
    return commit_import(payload.token, user, request)


async def _read_body_with_limit(request: Request) -> bytes:
    """Stream the request body, aborting once `_IMPORT_MAX_BYTES` is exceeded."""
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        if not chunk:
            continue
        total += len(chunk)
        if total > _IMPORT_MAX_BYTES:
            raise api_error(
                status.HTTP_413_CONTENT_TOO_LARGE,
                "catalog_import_too_large",
                f"Import file exceeds {_IMPORT_MAX_BYTES} byte limit.",
            )
        chunks.append(chunk)
    return b"".join(chunks)
