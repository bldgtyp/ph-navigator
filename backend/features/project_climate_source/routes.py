"""Project-scoped climate-source API routes (D-CL-4 / D-CL-11).

Reads require project view access; writes require an editor (signed-in)
user, mirroring the ``project_location`` router.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from starlette import status

from features.project_climate_source.models import (
    CreateProjectClimateSourceRequest,
    ProjectClimateSourceListResponse,
    ProjectClimateSourcePublic,
    RefreshAshraeDesignConditionsRequest,
    UpdateProjectClimateSourceRequest,
)
from features.project_climate_source.service import (
    create_project_climate_source,
    delete_project_climate_source,
    list_project_climate_sources,
    refresh_ashrae_design_conditions,
    set_default_climate_source,
    update_project_climate_source,
)
from features.projects.access import (
    ProjectAccess,
    require_editor_user,
    require_project_edit_access,
    require_project_view_access,
)

router = APIRouter(prefix="/api/v1/projects", tags=["project-climate-source"])

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


@router.get("/{project_id}/climate/sources", response_model=ProjectClimateSourceListResponse)
def get_sources(project_id: UUID, _access: ProjectViewAccess) -> ProjectClimateSourceListResponse:
    return list_project_climate_sources(project_id)


@router.post(
    "/{project_id}/climate/sources",
    response_model=ProjectClimateSourcePublic,
    status_code=status.HTTP_201_CREATED,
)
def post_source(
    project_id: UUID,
    payload: CreateProjectClimateSourceRequest,
    request: Request,
    access: ProjectEditAccess,
) -> ProjectClimateSourcePublic:
    user = require_editor_user(access)
    return create_project_climate_source(project_id, payload, user, request)


@router.post("/{project_id}/climate/sources/ashrae/current", response_model=ProjectClimateSourcePublic)
def post_current_ashrae(
    project_id: UUID,
    payload: RefreshAshraeDesignConditionsRequest,
    request: Request,
    access: ProjectEditAccess,
) -> ProjectClimateSourcePublic:
    user = require_editor_user(access)
    return refresh_ashrae_design_conditions(project_id, payload, user, request)


@router.patch("/{project_id}/climate/sources/{source_id}", response_model=ProjectClimateSourcePublic)
def patch_source(
    project_id: UUID,
    source_id: UUID,
    payload: UpdateProjectClimateSourceRequest,
    request: Request,
    access: ProjectEditAccess,
) -> ProjectClimateSourcePublic:
    user = require_editor_user(access)
    return update_project_climate_source(project_id, source_id, payload, user, request)


@router.delete("/{project_id}/climate/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source(
    project_id: UUID,
    source_id: UUID,
    request: Request,
    access: ProjectEditAccess,
) -> Response:
    user = require_editor_user(access)
    delete_project_climate_source(project_id, source_id, user, request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{project_id}/climate/sources/{source_id}/default", response_model=ProjectClimateSourcePublic)
def put_default(
    project_id: UUID,
    source_id: UUID,
    request: Request,
    access: ProjectEditAccess,
) -> ProjectClimateSourcePublic:
    user = require_editor_user(access)
    return set_default_climate_source(project_id, source_id, user, request)
