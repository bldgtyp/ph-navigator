"""Project location API routes."""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response

from features.assets.routes import AssetServiceDep
from features.project_location.models import (
    ElevationLookupRequest,
    ElevationLookupResponse,
    EpwParseResponse,
    GeocodeProjectLocationRequest,
    GeocodeProjectLocationResponse,
    ProjectLocation,
    ProjectLocationUpdateResponse,
    UpdateProjectLocationRequest,
)
from features.project_location.service import (
    derive_certification_source,
    derive_weather_source,
    geocode_project_location,
    get_project_location,
    get_project_sun_path,
    lookup_site_elevation,
    parse_epw_location,
    update_project_location,
)
from features.project_location.sun_path_schemas import SunPathAndCompassDTOSchema
from features.projects.access import (
    ProjectAccess,
    require_editor_user,
    require_project_edit_access,
    require_project_view_access,
)


class ClimateSourceDeriveKind(StrEnum):
    """Per-type "set from nearest" actions. ``weather`` is the EPW + STAT bundle."""

    phius = "phius"
    phi = "phi"
    weather = "weather"


router = APIRouter(prefix="/api/v1/projects", tags=["project-location"])

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


@router.get("/{project_id}/location", response_model=ProjectLocation)
def get_location(project_id: UUID, access: ProjectViewAccess) -> ProjectLocation:
    return get_project_location(project_id, include_private=access.is_editor)


@router.get("/{project_id}/sun-path", response_model=SunPathAndCompassDTOSchema | None)
def get_sun_path(project_id: UUID, _access: ProjectViewAccess, response: Response) -> SunPathAndCompassDTOSchema | None:
    # Location is editable in place, so the diagram can change -- revalidate
    # rather than reuse the immutable model_data cache policy (D-SP-1).
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


@router.post("/{project_id}/location/derive/{kind}", response_model=ProjectLocationUpdateResponse)
def derive_climate_source(
    project_id: UUID,
    kind: ClimateSourceDeriveKind,
    request: Request,
    access: ProjectEditAccess,
    asset_service: AssetServiceDep,
) -> ProjectLocationUpdateResponse:
    """Attach one climate type from the nearest source for the saved site.

    Each Climate page owns its own action: Phius, PHI, and Weather (the EPW + STAT bundle).
    """
    user = require_editor_user(access)
    if kind is ClimateSourceDeriveKind.weather:
        return derive_weather_source(project_id, user, request, asset_service)
    return derive_certification_source(project_id, kind.value, user, request)


@router.post("/{project_id}/location/geocode", response_model=GeocodeProjectLocationResponse)
def geocode_location(
    project_id: UUID,
    payload: GeocodeProjectLocationRequest,
    access: ProjectEditAccess,
) -> GeocodeProjectLocationResponse:
    require_editor_user(access)
    return geocode_project_location(payload)


@router.post("/{project_id}/location/elevation", response_model=ElevationLookupResponse)
def lookup_elevation(
    project_id: UUID,
    payload: ElevationLookupRequest,
    access: ProjectEditAccess,
) -> ElevationLookupResponse:
    # Project-scoped + editor-gated even though elevation is project-independent:
    # this reuses the standard access guard and avoids an open elevation proxy.
    require_editor_user(access)
    return lookup_site_elevation(payload.latitude, payload.longitude)


@router.post("/{project_id}/location/epw/parse", response_model=EpwParseResponse)
def parse_location_epw(
    asset_id: str,
    access: ProjectEditAccess,
    asset_service: AssetServiceDep,
) -> EpwParseResponse:
    require_editor_user(access)
    return parse_epw_location(access, asset_id, asset_service)
