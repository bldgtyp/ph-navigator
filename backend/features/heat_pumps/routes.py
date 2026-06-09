"""REST routes for Heat Pumps equipment."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query
from starlette import status

from database import connection
from features.heat_pumps.repository import get_active_version_id
from features.heat_pumps.service import (
    HeatPumpsPatchResponse,
    HeatPumpsReadResponse,
    HeatPumpTableKey,
    JsonPatchOp,
    apply_patch,
    compose_read,
)
from features.projects.access import ProjectAccess, require_project_edit_access, require_project_view_access
from features.shared.errors import api_error

router = APIRouter(prefix="/api/v1/projects/{project_id}/equipment/heat-pumps", tags=["heat-pumps"])

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


@router.get("", response_model=HeatPumpsReadResponse)
def get_heat_pumps(access: ProjectViewAccess) -> HeatPumpsReadResponse:
    return compose_read(_active_version_id(access.project_id), access)


@router.patch("/{table}", response_model=HeatPumpsPatchResponse)
def patch_heat_pumps_table(
    table: HeatPumpTableKey,
    payload: JsonPatchOp,
    access: ProjectEditAccess,
    if_match: Annotated[str | None, Header()] = None,
    if_match_version: Annotated[str | None, Header()] = None,
    dry_run: Annotated[bool, Query(alias="dry-run")] = False,
) -> HeatPumpsPatchResponse:
    return apply_patch(
        _active_version_id(access.project_id),
        table,
        payload,
        access,
        if_match=if_match,
        if_match_version=if_match_version,
        dry_run=dry_run,
    )


def _active_version_id(project_id: UUID) -> UUID:
    with connection() as conn:
        version_id = get_active_version_id(conn, project_id)
    if version_id is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "project_active_version_not_found",
            "Active project version not found.",
        )
    return version_id
