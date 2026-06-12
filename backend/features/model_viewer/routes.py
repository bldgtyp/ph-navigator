"""REST routes for Model tab HBJSON file management."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from starlette import status

from features.assets.routes import get_asset_service
from features.assets.service import AssetService
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
def post_hbjson_file(payload: HbjsonFileCreateRequest, access: ProjectEditAccess) -> HbjsonFilePublic:
    return create_file(payload, access)


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
