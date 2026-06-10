"""REST routes for Heat Pumps equipment."""

from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response
from starlette import status

from database import connection
from features.heat_pumps.phius_export import (
    PhiusExportResponse,
    compute_phius_payload,
    serialize_csv,
)
from features.heat_pumps.repository import get_active_version_id
from features.heat_pumps.service import (
    HeatPumpsPatchResponse,
    HeatPumpsReadResponse,
    HeatPumpTableKey,
    JsonPatchOp,
    OptionPatchOp,
    apply_option_patch,
    apply_patch,
    compose_read,
    read_slice,
)
from features.projects.access import ProjectAccess, require_project_edit_access, require_project_view_access
from features.shared.errors import api_error

router = APIRouter(prefix="/api/v1/projects/{project_id}/equipment/heat-pumps", tags=["heat-pumps"])

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]

PhiusExportFormat = Literal["json", "raw-csv", "xlsx-paste"]


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


@router.patch("/options/{option_key:path}", response_model=HeatPumpsReadResponse)
def patch_heat_pumps_option(
    option_key: str,
    payload: OptionPatchOp,
    access: ProjectEditAccess,
    if_match: Annotated[str | None, Header()] = None,
    if_match_version: Annotated[str | None, Header()] = None,
) -> HeatPumpsReadResponse:
    return apply_option_patch(
        _active_version_id(access.project_id),
        option_key,
        payload,
        access,
        if_match=if_match,
        if_match_version=if_match_version,
    )


@router.post("/export-phius", response_model=None)
def export_phius_estimator(
    access: ProjectViewAccess,
    export_format: Annotated[PhiusExportFormat, Query(alias="format")] = "json",
) -> PhiusExportResponse | Response:
    """Phius Multiple HP Performance Estimator export.

    Default returns wrapped JSON so the pre-export dialog can render
    warnings + row count while keeping the CSV body inline for the
    download step. ``raw-csv`` returns the CSV bytes directly for
    curl / MCP consumers. ``xlsx-paste`` is the OPQ-3 stretch and
    is not implemented in this slice.
    """

    if export_format == "xlsx-paste":
        raise api_error(
            status.HTTP_501_NOT_IMPLEMENTED,
            "phius_export_format_unsupported",
            "xlsx-paste payload is deferred (OPQ-3); use json or raw-csv.",
        )
    slice_ = read_slice(_active_version_id(access.project_id), access)
    payload = compute_phius_payload(slice_)
    csv_bytes = serialize_csv(payload)
    if export_format == "raw-csv":
        return Response(content=csv_bytes, media_type="text/csv; charset=utf-8")
    return PhiusExportResponse(
        rows=payload.rows,
        warnings=payload.warnings,
        csv=csv_bytes.decode("utf-8"),
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
