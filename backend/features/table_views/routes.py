"""Project-table view-state API routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from starlette import status

from features.projects.access import ProjectAccess, require_project_edit_access
from features.table_views.models import TableViewResponse, TableViewUpsertRequest
from features.table_views.service import (
    delete_table_view,
    get_table_view,
    upsert_table_view,
)

router = APIRouter(
    prefix="/api/v1/projects/{project_id}/table-views",
    tags=["table-views"],
)

ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


@router.get("/{table_key}", response_model=TableViewResponse)
def get_table_view_route(table_key: str, access: ProjectEditAccess) -> TableViewResponse:
    return get_table_view(table_key, access)


@router.put("/{table_key}", response_model=TableViewResponse)
def put_table_view_route(
    table_key: str,
    payload: TableViewUpsertRequest,
    access: ProjectEditAccess,
) -> TableViewResponse:
    return upsert_table_view(table_key, payload, access)


@router.delete("/{table_key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_table_view_route(table_key: str, access: ProjectEditAccess) -> None:
    delete_table_view(table_key, access)
