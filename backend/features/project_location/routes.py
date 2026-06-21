"""Project location API routes."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response

from features.assets.routes import AssetServiceDep
from features.model_viewer.schemas.ladybug import SunPathAndCompassDTOSchema
from features.project_location.models import (
    DeriveProjectLocationRequest,
    EpwParseResponse,
    GeocodeProjectLocationRequest,
    GeocodeProjectLocationResponse,
    ProjectLocation,
    ProjectLocationUpdateResponse,
    UpdateProjectLocationRequest,
)
from features.project_location.service import (
    derive_project_location,
    geocode_project_location,
    get_project_location,
    get_project_sun_path,
    parse_epw_location,
    update_project_location,
)
from features.projects.access import (
    ProjectAccess,
    require_editor_user,
    require_project_edit_access,
    require_project_view_access,
)

router = APIRouter(prefix="/api/v1/projects", tags=["project-location"])

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


@router.get("/{project_id}/location", response_model=ProjectLocation)
def get_location(project_id: UUID, access: ProjectViewAccess) -> ProjectLocation:
    return get_project_location(project_id, include_private=access.is_editor)


@router.get("/{project_id}/sun-path", response_model=SunPathAndCompassDTOSchema | None)
def get_sun_path(project_id: UUID, _access: ProjectViewAccess, response: Response) -> SunPathAndCompassDTOSchema | None:
    # Location is editable in place, so the diagram can change -- revalidate
    # rather than reuse the immutable model_data cache policy (D-CL-2).
    response.headers["Cache-Control"] = "private, max-age=0"
    return get_project_sun_path(project_id)


@router.put("/{project_id}/location", response_model=ProjectLocationUpdateResponse)
def put_location(
    project_id: UUID,
    payload: UpdateProjectLocationRequest,
    request: Request,
    access: ProjectEditAccess,
) -> ProjectLocationUpdateResponse:
    user = require_editor_user(access)
    return update_project_location(project_id, payload, user, request)


@router.post("/{project_id}/location/derive", response_model=ProjectLocationUpdateResponse)
def derive_location(
    project_id: UUID,
    payload: DeriveProjectLocationRequest,
    request: Request,
    access: ProjectEditAccess,
) -> ProjectLocationUpdateResponse:
    user = require_editor_user(access)
    return derive_project_location(project_id, payload, user, request)


@router.post("/{project_id}/location/geocode", response_model=GeocodeProjectLocationResponse)
def geocode_location(
    project_id: UUID,
    payload: GeocodeProjectLocationRequest,
    access: ProjectEditAccess,
) -> GeocodeProjectLocationResponse:
    require_editor_user(access)
    return geocode_project_location(payload)


@router.post("/{project_id}/location/epw/parse", response_model=EpwParseResponse)
def parse_location_epw(
    asset_id: str,
    access: ProjectEditAccess,
    asset_service: AssetServiceDep,
) -> EpwParseResponse:
    require_editor_user(access)
    return parse_epw_location(access, asset_id, asset_service)
