"""Project-document draft API routes."""

from __future__ import annotations

import json
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, Response

from features.project_document.document import ProjectDocumentV1
from features.project_document.models import (
    DiscardDraftResponse,
    ProjectDiffResponse,
    RoomsSliceReplaceRequest,
    RoomsSliceResponse,
    SaveAsDraftRequest,
    SaveDraftResponse,
    VersionPatchRequest,
)
from features.project_document.service import (
    discard_draft,
    get_draft_rooms_slice,
    get_project_diff,
    get_saved_document,
    get_saved_rooms_slice,
    patch_version,
    replace_rooms_slice,
    require_rooms_table,
    save_draft,
    save_draft_as,
)
from features.projects.access import ProjectAccess, require_project_edit_access, require_project_view_access
from features.projects.models import ProjectDetail

router = APIRouter(prefix="/api/v1/projects/{project_id}/versions/{version_id}", tags=["project-document"])

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


@router.get("/document", response_model=ProjectDocumentV1)
def get_document(
    version_id: UUID,
    access: ProjectViewAccess,
) -> ProjectDocumentV1:
    return get_saved_document(version_id, access)


@router.get("/document/tables/{table_name}", response_model=RoomsSliceResponse)
def get_saved_table(
    version_id: UUID,
    table_name: str,
    access: ProjectViewAccess,
) -> RoomsSliceResponse:
    require_rooms_table(table_name)
    return get_saved_rooms_slice(version_id, access)


@router.get("/draft/tables/{table_name}", response_model=RoomsSliceResponse)
def get_draft_table(
    version_id: UUID,
    table_name: str,
    access: ProjectEditAccess,
) -> RoomsSliceResponse:
    require_rooms_table(table_name)
    return get_draft_rooms_slice(version_id, access)


@router.put("/draft/tables/{table_name}", response_model=RoomsSliceResponse)
def put_draft_table(
    version_id: UUID,
    table_name: str,
    payload: RoomsSliceReplaceRequest,
    access: ProjectEditAccess,
    if_match: Annotated[str | None, Header()] = None,
    if_match_version: Annotated[str | None, Header()] = None,
) -> RoomsSliceResponse:
    require_rooms_table(table_name)
    return replace_rooms_slice(version_id, payload, access, if_match=if_match, if_match_version=if_match_version)


@router.delete("/draft", response_model=DiscardDraftResponse)
def delete_draft(
    version_id: UUID,
    access: ProjectEditAccess,
) -> DiscardDraftResponse:
    return discard_draft(version_id, access)


@router.post("/draft/save", response_model=SaveDraftResponse)
def post_draft_save(
    version_id: UUID,
    access: ProjectEditAccess,
    request: Request,
    if_match: Annotated[str | None, Header()] = None,
) -> SaveDraftResponse:
    return save_draft(version_id, access, if_match=if_match, request=request)


@router.post("/draft/save-as", response_model=SaveDraftResponse)
def post_draft_save_as(
    version_id: UUID,
    payload: SaveAsDraftRequest,
    access: ProjectEditAccess,
    request: Request,
) -> SaveDraftResponse:
    return save_draft_as(version_id, payload, access, request=request)


@router.patch("", response_model=ProjectDetail)
def patch_project_version(
    version_id: UUID,
    payload: VersionPatchRequest,
    access: ProjectEditAccess,
    request: Request,
) -> ProjectDetail:
    return patch_version(version_id, payload, access, request=request)


@router.get("/download")
def download_document(
    version_id: UUID,
    access: ProjectViewAccess,
) -> Response:
    document = get_saved_document(version_id, access)
    return json_download_response(document.model_dump_json(), f"project-{version_id}.json")


@router.get("/download/tables/{table_name}")
def download_table(
    version_id: UUID,
    table_name: str,
    access: ProjectViewAccess,
) -> Response:
    require_rooms_table(table_name)
    document = get_saved_document(version_id, access)
    content = [room.model_dump(mode="json") for room in document.tables.rooms]
    return json_download_response(json.dumps(content, separators=(",", ":")), f"{table_name}-{version_id}.json")


def json_download_response(content: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


diff_router = APIRouter(prefix="/api/v1/projects/{project_id}", tags=["project-document"])


@diff_router.get("/diff", response_model=ProjectDiffResponse)
def get_diff(
    access: ProjectViewAccess,
    from_version_id: Annotated[UUID, Query(alias="from")],
    to: str,
) -> ProjectDiffResponse:
    return get_project_diff(from_version_id, to, access)
