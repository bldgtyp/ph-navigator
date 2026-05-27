"""Project shell API routes."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from starlette import status

from features.auth.routes import CurrentUser
from features.projects.access import (
    ProjectAccess,
    require_editor_user,
    require_project_edit_access,
    require_project_view_access,
)
from features.projects.models import (
    AccessMode,
    BtNumberAvailabilityResponse,
    CreateProjectRequest,
    ProjectBulkDeleteRequest,
    ProjectBulkDeleteResponse,
    ProjectDeletedListResponse,
    ProjectDeleteRequest,
    ProjectDeleteResponse,
    ProjectDetail,
    ProjectListResponse,
    UpdateProjectRequest,
)
from features.projects.service import (
    bulk_delete_projects,
    check_bt_number_available,
    create_project,
    delete_project,
    get_project_detail,
    list_dashboard_projects,
    list_deleted_dashboard_projects,
    restore_project,
    update_project_metadata,
)

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


@router.get("", response_model=ProjectListResponse)
def list_projects(auth: CurrentUser) -> ProjectListResponse:
    user, _expires_at = auth
    return list_dashboard_projects(user)


@router.post("", response_model=ProjectDetail, status_code=status.HTTP_201_CREATED)
def post_project(
    payload: CreateProjectRequest,
    request: Request,
    auth: CurrentUser,
) -> ProjectDetail:
    user, _expires_at = auth
    return create_project(payload, user, request)


@router.post(":bulk-delete", response_model=ProjectBulkDeleteResponse)
def post_projects_bulk_delete(
    payload: ProjectBulkDeleteRequest,
    request: Request,
    auth: CurrentUser,
) -> ProjectBulkDeleteResponse:
    user, _expires_at = auth
    return bulk_delete_projects(payload, user, request)


@router.get("/deleted", response_model=ProjectDeletedListResponse)
def list_deleted_projects(auth: CurrentUser) -> ProjectDeletedListResponse:
    user, _expires_at = auth
    return list_deleted_dashboard_projects(user)


@router.get("/check-bt-number", response_model=BtNumberAvailabilityResponse)
def check_bt_number(
    value: str,
    _auth: CurrentUser,
) -> BtNumberAvailabilityResponse:
    return check_bt_number_available(value)


@router.post("/{project_id}:delete", response_model=ProjectDeleteResponse)
def post_project_delete(
    project_id: UUID,
    payload: ProjectDeleteRequest,
    request: Request,
    auth: CurrentUser,
) -> ProjectDeleteResponse:
    user, _expires_at = auth
    return delete_project(project_id, payload, user, request)


@router.post("/{project_id}:restore", response_model=ProjectDetail)
def post_project_restore(
    project_id: UUID,
    request: Request,
    auth: CurrentUser,
) -> ProjectDetail:
    user, _expires_at = auth
    return restore_project(project_id, user, request)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: UUID,
    access: ProjectViewAccess,
) -> ProjectDetail:
    access_mode: AccessMode = "editor" if access.is_editor else "viewer"
    return get_project_detail(project_id, access_mode=access_mode)


@router.patch("/{project_id}", response_model=ProjectDetail)
def patch_project(
    project_id: UUID,
    payload: UpdateProjectRequest,
    request: Request,
    access: ProjectEditAccess,
) -> ProjectDetail:
    user = require_editor_user(access)
    return update_project_metadata(project_id, payload, user, request)
