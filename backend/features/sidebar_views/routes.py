"""Project-sidebar view-state API routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from starlette import status

from features.projects.access import ProjectAccess, require_project_edit_access
from features.sidebar_views.models import (
    SidebarViewResponse,
    SidebarViewUpsertRequest,
)
from features.sidebar_views.service import (
    delete_sidebar_view,
    get_sidebar_view,
    upsert_sidebar_view,
)

router = APIRouter(
    prefix="/api/v1/projects/{project_id}/sidebar-views",
    tags=["sidebar-views"],
)

ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


@router.get("/{view_key}", response_model=SidebarViewResponse)
def get_sidebar_view_route(view_key: str, access: ProjectEditAccess) -> SidebarViewResponse:
    return get_sidebar_view(view_key, access)


@router.put("/{view_key}", response_model=SidebarViewResponse)
def put_sidebar_view_route(
    view_key: str,
    payload: SidebarViewUpsertRequest,
    access: ProjectEditAccess,
) -> SidebarViewResponse:
    return upsert_sidebar_view(view_key, payload, access)


@router.delete("/{view_key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sidebar_view_route(view_key: str, access: ProjectEditAccess) -> None:
    delete_sidebar_view(view_key, access)
