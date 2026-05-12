"""Project lifecycle status API routes."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from starlette import status

from features.project_status.models import (
    StatusItemCreateRequest,
    StatusItemListResponse,
    StatusItemPublic,
    StatusItemUpdateRequest,
)
from features.project_status.service import (
    apply_default_template,
    create_status_item,
    delete_status_item,
    list_project_status_items,
    update_status_item,
)
from features.projects.access import ProjectAccess, require_project_edit_access, require_project_view_access

router = APIRouter(prefix="/api/v1/projects/{project_id}/status-items", tags=["project-status"])

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


@router.get("", response_model=StatusItemListResponse)
def get_status_items(access: ProjectViewAccess) -> StatusItemListResponse:
    return list_project_status_items(access)


@router.post("", response_model=StatusItemPublic, status_code=status.HTTP_201_CREATED)
def post_status_item(payload: StatusItemCreateRequest, access: ProjectEditAccess) -> StatusItemPublic:
    return create_status_item(payload, access)


@router.post("/apply-default-template", response_model=StatusItemListResponse)
def post_default_template(access: ProjectEditAccess) -> StatusItemListResponse:
    return apply_default_template(access)


@router.patch("/{item_id}", response_model=StatusItemPublic)
def patch_status_item(
    item_id: UUID,
    payload: StatusItemUpdateRequest,
    access: ProjectEditAccess,
) -> StatusItemPublic:
    return update_status_item(item_id, payload, access)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_status_item_route(item_id: UUID, access: ProjectEditAccess) -> None:
    delete_status_item(item_id, access)
