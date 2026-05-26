"""REST routes for project assets."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from fastapi.responses import RedirectResponse, Response
from starlette import status

from config import settings
from features.assets.schemas import (
    AssetRow,
    AssetUrlsResponse,
    AttachAssetRequest,
    BulkAssetUrlsResponse,
    BulkDownloadRequest,
    BulkUploadIntentRequest,
    BulkUploadIntentResponse,
    DetachAssetRequest,
    JobResponse,
    PatchAssetRequest,
    UploadIntentRequest,
    UploadIntentResponse,
)
from features.assets.service import AssetService
from features.assets.storage_r2 import R2Client
from features.assets.thumbnailer import Thumbnailer
from features.projects.access import ProjectAccess, require_project_edit_access, require_project_view_access

router = APIRouter(prefix="/api/v1/projects/{project_id}/assets", tags=["assets"])
jobs_router = APIRouter(prefix="/api/v1/projects/{project_id}/jobs", tags=["jobs"])

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


def get_asset_service() -> AssetService:
    r2 = R2Client(settings)
    return AssetService(r2, Thumbnailer(r2))


AssetServiceDep = Annotated[AssetService, Depends(get_asset_service)]


@router.get("", response_model=list[AssetRow])
def list_assets(
    access: ProjectViewAccess,
    service: AssetServiceDep,
    kind: Annotated[str | None, Query()] = None,
) -> list[AssetRow]:
    return service.list_assets(access, kind=kind)


@router.post("/upload-intent", response_model=UploadIntentResponse)
def create_upload_intent(
    payload: UploadIntentRequest,
    access: ProjectEditAccess,
    service: AssetServiceDep,
) -> UploadIntentResponse:
    return service.create_upload_intent(access, payload)


@router.post("/bulk-upload-intent", response_model=BulkUploadIntentResponse)
def create_bulk_upload_intent(
    payload: BulkUploadIntentRequest,
    access: ProjectEditAccess,
    service: AssetServiceDep,
) -> BulkUploadIntentResponse:
    return service.create_bulk_upload_intent(access, payload.items)


@router.post("/{asset_id}/complete-upload", response_model=AssetRow)
def complete_upload(
    asset_id: str,
    background_tasks: BackgroundTasks,
    access: ProjectEditAccess,
    service: AssetServiceDep,
) -> AssetRow:
    return service.complete_upload(access, asset_id, background_tasks)


@router.get("/bulk-urls", response_model=BulkAssetUrlsResponse)
def get_bulk_urls(
    ids: Annotated[str, Query()],
    access: ProjectViewAccess,
    service: AssetServiceDep,
) -> BulkAssetUrlsResponse:
    asset_ids = [item.strip() for item in ids.split(",") if item.strip()]
    return BulkAssetUrlsResponse(items=service.bulk_urls(access, asset_ids))


@router.post("/bulk-download", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
def start_bulk_download(
    payload: BulkDownloadRequest,
    access: ProjectEditAccess,
    service: AssetServiceDep,
) -> JobResponse:
    return service.start_bulk_download(access, payload)


@router.get("/{asset_id}", response_model=AssetRow)
def get_asset(asset_id: str, access: ProjectViewAccess, service: AssetServiceDep) -> AssetRow:
    return service.get_asset(access, asset_id)


@router.patch("/{asset_id}", response_model=AssetRow)
def patch_asset(
    asset_id: str,
    payload: PatchAssetRequest,
    access: ProjectEditAccess,
    service: AssetServiceDep,
) -> AssetRow:
    if payload.display_name is None:
        return service.get_asset(access, asset_id)
    return service.patch_display_name(access, asset_id, payload.display_name)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: str, access: ProjectEditAccess, service: AssetServiceDep) -> Response:
    service.soft_delete(access, asset_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{asset_id}/url", response_model=AssetUrlsResponse)
def get_asset_url(asset_id: str, access: ProjectViewAccess, service: AssetServiceDep) -> AssetUrlsResponse:
    return service.get_asset_urls(access, asset_id)


@router.get("/{asset_id}/download")
def download_asset(asset_id: str, access: ProjectViewAccess, service: AssetServiceDep) -> RedirectResponse:
    urls = service.get_asset_urls(access, asset_id)
    return RedirectResponse(urls.download_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@router.post("/{asset_id}/attach")
def attach_asset(
    asset_id: str,
    payload: AttachAssetRequest,
    access: ProjectEditAccess,
    service: AssetServiceDep,
) -> dict[str, object]:
    return service.attach_asset(access, asset_id, payload)


@router.post("/{asset_id}/detach")
def detach_asset(
    asset_id: str,
    payload: DetachAssetRequest,
    access: ProjectEditAccess,
    service: AssetServiceDep,
) -> dict[str, object]:
    return service.detach_asset(access, asset_id, payload)


@jobs_router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: str, access: ProjectViewAccess, service: AssetServiceDep) -> JobResponse:
    return service.get_job(access, job_id)
