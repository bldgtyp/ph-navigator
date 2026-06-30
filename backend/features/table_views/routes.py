"""Project-table view-state API routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from starlette import status

from features.projects.access import ProjectAccess, require_project_edit_access
from features.table_views.models import (
    BatchTableViewsResponse,
    TableViewResponse,
    TableViewUpsertRequest,
)
from features.table_views.service import (
    delete_table_view,
    get_table_view,
    get_table_views,
    upsert_table_view,
)

router = APIRouter(
    prefix="/api/v1/projects/{project_id}/table-views",
    tags=["table-views"],
)

ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]

# Upper bound on the batch read so the `table_key = ANY(...)` list is never
# unbounded; comfortably above any page's table count (equipment is 7).
MAX_BATCH_TABLE_KEYS = 64


# Declared before `/{table_key}` so the collection read is never shadowed by
# the item route. Replaces the per-table view-state fan-out (one GET per
# table) with a single request for a page's whole table set.
@router.get("", response_model=BatchTableViewsResponse)
def get_table_views_route(
    access: ProjectEditAccess,
    keys: Annotated[list[str], Query(min_length=1, max_length=MAX_BATCH_TABLE_KEYS)],
) -> BatchTableViewsResponse:
    return get_table_views(keys, access)


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
