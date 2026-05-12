"""Project-document draft API routes."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header

from features.project_document.models import RoomsSliceReplaceRequest, RoomsSliceResponse
from features.project_document.service import (
    get_draft_rooms_slice,
    get_saved_rooms_slice,
    replace_rooms_slice,
    require_rooms_table,
)
from features.projects.access import ProjectAccess, require_project_edit_access, require_project_view_access

router = APIRouter(prefix="/api/v1/projects/{project_id}/versions/{version_id}", tags=["project-document"])

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


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
