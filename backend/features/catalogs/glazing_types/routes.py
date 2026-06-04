"""Window-Glazing catalog API routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Request
from starlette import status

from features.auth.routes import CurrentUser
from features.catalogs.glazing_types.models import (
    CatalogGlazingTypeCreateRequest,
    CatalogGlazingTypeListResponse,
    CatalogGlazingTypePublic,
    CatalogGlazingTypeUpdateRequest,
)
from features.catalogs.glazing_types.service import (
    create_glazing_type,
    deactivate_glazing_type,
    duplicate_glazing_type,
    get_glazing_type,
    list_glazing_types,
    reactivate_glazing_type,
    update_glazing_type,
)

router = APIRouter(prefix="/api/v1/catalogs/glazing-types", tags=["catalogs"])


@router.get("", response_model=CatalogGlazingTypeListResponse)
def get_glazing_types(
    auth: CurrentUser,
    include_inactive: Annotated[bool, Query()] = False,
) -> CatalogGlazingTypeListResponse:
    del auth
    return list_glazing_types(include_inactive=include_inactive)


@router.post("", response_model=CatalogGlazingTypePublic, status_code=status.HTTP_201_CREATED)
def post_glazing_type(
    payload: CatalogGlazingTypeCreateRequest, request: Request, auth: CurrentUser
) -> CatalogGlazingTypePublic:
    user, _expires_at = auth
    return create_glazing_type(payload, user, request)


@router.get("/{record_id}", response_model=CatalogGlazingTypePublic)
def get_one_glazing_type(record_id: str, auth: CurrentUser) -> CatalogGlazingTypePublic:
    del auth
    return get_glazing_type(record_id)


@router.patch("/{record_id}", response_model=CatalogGlazingTypePublic)
def patch_glazing_type(
    record_id: str,
    payload: CatalogGlazingTypeUpdateRequest,
    request: Request,
    auth: CurrentUser,
) -> CatalogGlazingTypePublic:
    user, _expires_at = auth
    return update_glazing_type(record_id, payload, user, request)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_glazing_type_route(record_id: str, request: Request, auth: CurrentUser) -> None:
    user, _expires_at = auth
    deactivate_glazing_type(record_id, user, request)


@router.post("/{record_id}/reactivate", response_model=CatalogGlazingTypePublic)
def reactivate_glazing_type_route(record_id: str, request: Request, auth: CurrentUser) -> CatalogGlazingTypePublic:
    user, _expires_at = auth
    return reactivate_glazing_type(record_id, user, request)


@router.post(
    "/{record_id}/duplicate",
    response_model=CatalogGlazingTypePublic,
    status_code=status.HTTP_201_CREATED,
)
def post_glazing_type_duplicate(
    record_id: str,
    request: Request,
    auth: CurrentUser,
) -> CatalogGlazingTypePublic:
    user, _expires_at = auth
    return duplicate_glazing_type(record_id, user, request)
