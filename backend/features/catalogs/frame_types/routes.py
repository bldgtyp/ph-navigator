"""Window-Frame catalog API routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from starlette import status

from features.auth.models import UserPublic
from features.auth.routes import require_current_user
from features.catalogs.frame_types.models import (
    CatalogFrameTypeCreateRequest,
    CatalogFrameTypeListResponse,
    CatalogFrameTypePublic,
    CatalogFrameTypeUpdateRequest,
)
from features.catalogs.frame_types.service import (
    create_frame_type,
    deactivate_frame_type,
    get_frame_type,
    list_frame_types,
    reactivate_frame_type,
    update_frame_type,
)

CurrentUser = Annotated[tuple[UserPublic, object], Depends(require_current_user)]

router = APIRouter(prefix="/api/v1/catalogs/frame-types", tags=["catalogs"])


@router.get("", response_model=CatalogFrameTypeListResponse)
def get_frame_types(
    auth: CurrentUser,
    include_inactive: Annotated[bool, Query()] = False,
) -> CatalogFrameTypeListResponse:
    del auth
    return list_frame_types(include_inactive=include_inactive)


@router.post("", response_model=CatalogFrameTypePublic, status_code=status.HTTP_201_CREATED)
def post_frame_type(
    payload: CatalogFrameTypeCreateRequest, request: Request, auth: CurrentUser
) -> CatalogFrameTypePublic:
    user, _expires_at = auth
    return create_frame_type(payload, user, request)


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
