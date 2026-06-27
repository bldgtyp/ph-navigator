"""Materials catalog API routes.

Catalogs are firm-wide / global (not project-scoped). Reads and writes require
an authenticated user; ACL hardening beyond "any signed-in editor" is deferred
to a later slice once the firm-vs-org model exists.
"""

from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Query, Request
from starlette import status

from features.auth.routes import CurrentUser
from features.catalogs.access import CatalogEditor
from features.catalogs.materials.import_export.service import (
    CommitRequest,
    CommitResponse,
    PreviewResponse,
    commit_import,
    preview_import,
)
from features.catalogs.materials.models import (
    CatalogMaterialCreateRequest,
    CatalogMaterialListResponse,
    CatalogMaterialPublic,
    CatalogMaterialUpdateRequest,
)
from features.catalogs.materials.service import (
    create_material,
    deactivate_material,
    duplicate_material,
    get_material,
    list_materials,
    reactivate_material,
    update_material,
)
from features.shared.errors import api_error

# 8 MB cap. Catalogs are small (~200 KB per thousand rows); the limit
# is here to stop a stray multi-megabyte upload from OOM-ing the
# server, not to size legitimate imports.
_IMPORT_MAX_BYTES: int = 8 * 1024 * 1024

router = APIRouter(prefix="/api/v1/catalogs/materials", tags=["catalogs"])


@router.get("", response_model=CatalogMaterialListResponse)
def get_materials(
    auth: CurrentUser,
    include_inactive: Annotated[bool, Query()] = False,
) -> CatalogMaterialListResponse:
    del auth
    return list_materials(include_inactive=include_inactive)


@router.post("", response_model=CatalogMaterialPublic, status_code=status.HTTP_201_CREATED)
def post_material(
    payload: CatalogMaterialCreateRequest, request: Request, auth: CatalogEditor
) -> CatalogMaterialPublic:
    user, _expires_at = auth
    return create_material(payload, user, request)


@router.get("/{material_id}", response_model=CatalogMaterialPublic)
def get_one_material(material_id: str, auth: CurrentUser) -> CatalogMaterialPublic:
    del auth
    return get_material(material_id)


@router.patch("/{material_id}", response_model=CatalogMaterialPublic)
def patch_material(
    material_id: str,
    payload: CatalogMaterialUpdateRequest,
    request: Request,
    auth: CatalogEditor,
) -> CatalogMaterialPublic:
    user, _expires_at = auth
    return update_material(material_id, payload, user, request)


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material_route(material_id: str, request: Request, auth: CatalogEditor) -> None:
    user, _expires_at = auth
    deactivate_material(material_id, user, request)


@router.post("/{material_id}/reactivate", response_model=CatalogMaterialPublic)
def reactivate_material_route(material_id: str, request: Request, auth: CatalogEditor) -> CatalogMaterialPublic:
    user, _expires_at = auth
    return reactivate_material(material_id, user, request)


@router.post(
    "/{material_id}/duplicate",
    response_model=CatalogMaterialPublic,
    status_code=status.HTTP_201_CREATED,
)
def post_material_duplicate(
    material_id: str,
    request: Request,
    auth: CatalogEditor,
) -> CatalogMaterialPublic:
    user, _expires_at = auth
    return duplicate_material(material_id, user, request)


@router.post("/import/preview", response_model=PreviewResponse)
async def post_import_preview(
    request: Request,
    auth: CatalogEditor,
) -> PreviewResponse:
    """Dry-run an import: parse, upgrade, coerce, dedup, return a report.

    Body is the raw catalog-file JSON. The pipeline returns counts +
    grouped warnings/errors + a token the caller exchanges at
    `/import/commit`. No DB writes happen here.

    Body is read manually (rather than declared as a Pydantic-bound
    parameter) so the 8 MB cap is enforced WHILE streaming, before any
    JSON parsing allocates a dict. This protects against both
    Content-Length-lying clients and chunked-transfer uploads that
    omit Content-Length entirely.
    """
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
    auth: CatalogEditor,
) -> CommitResponse:
    """Insert the rows cached under a preview token (single transaction)."""
    user, _expires_at = auth
    return commit_import(payload.token, user, request)


async def _read_body_with_limit(request: Request) -> bytes:
    """Stream the request body, aborting once `_IMPORT_MAX_BYTES` is
    exceeded.

    Falls back to `await request.body()` semantics on the happy path,
    but cuts the read early on oversize input so a malicious 500 MB
    POST never allocates 500 MB. Works the same for both
    Content-Length and chunked transfers — we never trust the header.
    """
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
