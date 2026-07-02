"""Project-scoped climate-source API routes (D-CL-4).

Reads require project view access; writes require an editor (signed-in)
user, mirroring the ``project_location`` router.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from starlette import status

from features.assets.routes import AssetServiceDep
from features.climate.models import ClimateLocationDetail
from features.climate.proximity import PhDatasetProvider
from features.project_climate_source.models import (
    AttachWeatherFromCatalogRequest,
    AttachWeatherFromUploadRequest,
    ClimateDatasetRosterResponse,
    CreateProjectClimateSourceRequest,
    EpwRosterResponse,
    ProjectClimateSourceListResponse,
    ProjectClimateSourcePublic,
    RefreshAshraeDesignConditionsRequest,
    UpdateProjectClimateSourceRequest,
)
from features.project_climate_source.service import (
    attach_weather_source_from_catalog,
    attach_weather_source_from_upload,
    create_project_climate_source,
    delete_project_climate_source,
    get_attached_climate_record,
    get_project_dataset_roster,
    get_project_epw_roster,
    list_project_climate_sources,
    refresh_ashrae_design_conditions,
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


@router.get("/{project_id}/climate/sources/{source_id}/record", response_model=ClimateLocationDetail)
def get_source_record(project_id: UUID, source_id: UUID, _access: ProjectViewAccess) -> ClimateLocationDetail:
    return get_attached_climate_record(project_id, source_id)


@router.get(
    "/{project_id}/climate/datasets/{kind}/locations",
    response_model=ClimateDatasetRosterResponse,
)
def get_dataset_roster(
    project_id: UUID,
    kind: PhDatasetProvider,
    access: ProjectEditAccess,
    region: Annotated[str | None, Query(description="State filter; defaults to the project's state")] = None,
    near: Annotated[bool, Query(description="Order by nearest across all states (any-state mode)")] = False,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ClimateDatasetRosterResponse:
    """Authoritative picker feed: a PH dataset's stations for this project,
    each with backend-computed proximity, sorted nearest-first. Editor-only."""
    require_editor_user(access)
    return get_project_dataset_roster(project_id, kind, region=region, near=near, limit=limit, offset=offset)


@router.get("/{project_id}/climate/epw-roster", response_model=EpwRosterResponse)
def get_epw_roster(
    project_id: UUID,
    access: ProjectEditAccess,
    region: Annotated[str | None, Query(description="State filter; defaults to the project's state")] = None,
    near: Annotated[bool, Query(description="Order by nearest across the USA (any-state mode)")] = False,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> EpwRosterResponse:
    """Weather picker feed: OneBuilding EPW stations for this project, nearest-first.

    Informational distance / elevation delta only — no certification verdict (D4).
    Editor-only, like the PH dataset roster."""
    require_editor_user(access)
    return get_project_epw_roster(project_id, region=region, near=near, limit=limit)


@router.post(
    "/{project_id}/climate/sources/weather/from-catalog",
    response_model=ProjectClimateSourcePublic,
)
def post_weather_from_catalog(
    project_id: UUID,
    payload: AttachWeatherFromCatalogRequest,
    request: Request,
    access: ProjectEditAccess,
    asset_service: AssetServiceDep,
) -> ProjectClimateSourcePublic:
    """Attach the map-picked OneBuilding station: download + parse + store as the
    single weather source (same shape as the nearest-derive). Editor-only."""
    user = require_editor_user(access)
    return attach_weather_source_from_catalog(project_id, payload.url, user, request, asset_service)


@router.post(
    "/{project_id}/climate/sources/weather/from-upload",
    response_model=ProjectClimateSourcePublic,
)
def post_weather_from_upload(
    project_id: UUID,
    payload: AttachWeatherFromUploadRequest,
    request: Request,
    access: ProjectEditAccess,
    asset_service: AssetServiceDep,
) -> ProjectClimateSourcePublic:
    """Attach a manually-uploaded EPW + STAT + DDY bundle (asset ids): validate +
    parse the EPW header / STAT into the single weather source. Editor-only."""
    user = require_editor_user(access)
    return attach_weather_source_from_upload(
        access,
        epw_asset_id=payload.epw_asset_id,
        stat_asset_id=payload.stat_asset_id,
        ddy_asset_id=payload.ddy_asset_id,
        user=user,
        request_meta=request,
        asset_service=asset_service,
    )


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
