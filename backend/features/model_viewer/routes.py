"""REST routes for Model tab HBJSON file management."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Response
from fastapi.responses import JSONResponse, RedirectResponse
from starlette import status

from features.assets.routes import get_asset_service
from features.assets.service import AssetService
from features.model_viewer import model_data
from features.model_viewer.models import (
    HbjsonFileCreateRequest,
    HbjsonFileListResponse,
    HbjsonFilePublic,
    HbjsonFileUpdateRequest,
)
from features.model_viewer.service import (
    create_file,
    delete_file,
    get_download_urls,
    list_files,
    update_file,
)
from features.projects.access import ProjectAccess, require_project_edit_access, require_project_view_access

router = APIRouter(prefix="/api/v1/projects/{project_id}/hbjson-files", tags=["model-viewer"])

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]
AssetServiceDep = Annotated[AssetService, Depends(get_asset_service)]


@router.get("", response_model=HbjsonFileListResponse)
def get_hbjson_files(access: ProjectViewAccess) -> HbjsonFileListResponse:
    return list_files(access)


@router.post("", response_model=HbjsonFilePublic, status_code=status.HTTP_201_CREATED)
def post_hbjson_file(
    payload: HbjsonFileCreateRequest,
    access: ProjectEditAccess,
    background_tasks: BackgroundTasks,
    service: AssetServiceDep,
) -> HbjsonFilePublic:
    return create_file(payload, access, background_tasks=background_tasks, storage=service.r2)


@router.patch("/{file_id}", response_model=HbjsonFilePublic)
def patch_hbjson_file(
    file_id: UUID,
    payload: HbjsonFileUpdateRequest,
    access: ProjectEditAccess,
) -> HbjsonFilePublic:
    return update_file(file_id, payload, access)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hbjson_file(file_id: UUID, access: ProjectEditAccess) -> None:
    delete_file(file_id, access)


@router.get("/{file_id}/download")
def download_hbjson_file(
    file_id: UUID,
    access: ProjectViewAccess,
    service: AssetServiceDep,
) -> RedirectResponse:
    urls = get_download_urls(file_id, access, service)
    return RedirectResponse(urls.download_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@router.get("/{file_id}/model_data")
def get_model_data(
    file_id: UUID,
    access: ProjectViewAccess,
    service: AssetServiceDep,
    if_none_match: Annotated[str | None, Header()] = None,
) -> Response:
    """The viewer's only data call: the precomputed gzip'd artifact (D-15)."""
    return model_data.serve_model_data(file_id, access, service.r2, if_none_match)


def _subset_route(file_id: UUID, access: ProjectAccess, service: AssetService, key: str) -> JSONResponse:
    # Raw JSON passthrough by design: the artifact was schema-shaped when
    # written; re-validating thousands of faces would undo D-15.
    return JSONResponse(model_data.read_model_data_subset(file_id, access, service.r2, key))


@router.get("/{file_id}/faces")
def get_faces(file_id: UUID, access: ProjectViewAccess, service: AssetServiceDep) -> JSONResponse:
    return _subset_route(file_id, access, service, "faces")


@router.get("/{file_id}/spaces")
def get_spaces(file_id: UUID, access: ProjectViewAccess, service: AssetServiceDep) -> JSONResponse:
    return _subset_route(file_id, access, service, "spaces")


@router.get("/{file_id}/ventilation_systems")
def get_ventilation_systems(file_id: UUID, access: ProjectViewAccess, service: AssetServiceDep) -> JSONResponse:
    return _subset_route(file_id, access, service, "ventilation_systems")


@router.get("/{file_id}/hot_water_systems")
def get_hot_water_systems(file_id: UUID, access: ProjectViewAccess, service: AssetServiceDep) -> JSONResponse:
    return _subset_route(file_id, access, service, "hot_water_systems")


@router.get("/{file_id}/shading_elements")
def get_shading_elements(file_id: UUID, access: ProjectViewAccess, service: AssetServiceDep) -> JSONResponse:
    return _subset_route(file_id, access, service, "shading_elements")
