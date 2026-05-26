"""Materials catalog API routes.

Catalogs are firm-wide / global (not project-scoped). Reads and writes require
an authenticated user; ACL hardening beyond "any signed-in editor" is deferred
to a later slice once the firm-vs-org model exists.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Request
from starlette import status

from features.auth.routes import CurrentUser
from features.catalogs.materials.models import (
    CatalogMaterialCreateRequest,
    CatalogMaterialListResponse,
    CatalogMaterialPublic,
    CatalogMaterialUpdateRequest,
)
from features.catalogs.materials.service import (
    create_material,
    deactivate_material,
    get_material,
    list_materials,
    reactivate_material,
    update_material,
)

router = APIRouter(prefix="/api/v1/catalogs/materials", tags=["catalogs"])


@router.get("", response_model=CatalogMaterialListResponse)
def get_materials(
    auth: CurrentUser,
    include_inactive: Annotated[bool, Query()] = False,
) -> CatalogMaterialListResponse:
    del auth
    return list_materials(include_inactive=include_inactive)


@router.post("", response_model=CatalogMaterialPublic, status_code=status.HTTP_201_CREATED)
def post_material(payload: CatalogMaterialCreateRequest, request: Request, auth: CurrentUser) -> CatalogMaterialPublic:
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
    auth: CurrentUser,
) -> CatalogMaterialPublic:
    user, _expires_at = auth
    return update_material(material_id, payload, user, request)


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material_route(material_id: str, request: Request, auth: CurrentUser) -> None:
    user, _expires_at = auth
    deactivate_material(material_id, user, request)


@router.post("/{material_id}/reactivate", response_model=CatalogMaterialPublic)
def reactivate_material_route(material_id: str, request: Request, auth: CurrentUser) -> CatalogMaterialPublic:
    user, _expires_at = auth
    return reactivate_material(material_id, user, request)
