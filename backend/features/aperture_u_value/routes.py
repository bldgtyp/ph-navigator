"""REST endpoint exposing per-aperture composite U-Values.

``GET /api/v1/projects/{id}/versions/{vid}/apertures/u-values?source=draft|version``
returns a list of ``ApertureUValueResult`` (one per aperture type in
the document). The service caches each result by content hash, so a
no-op refetch is essentially free.

Authorization mirrors the document slice routes: ``draft`` requires
edit access, ``version`` requires view access.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from features.access.capabilities import APERTURE_EXPORT_U_VALUE_REPORT
from features.aperture_u_value.models import (
    AperturesUValueListResponse,
    ApertureUValueReport,
)
from features.aperture_u_value.report import get_aperture_u_value_report as get_report
from features.aperture_u_value.report_csv import render_aperture_u_value_csv
from features.aperture_u_value.report_xlsx import render_aperture_u_value_xlsx
from features.aperture_u_value.service import calculate_aperture_u_values
from features.aperture_u_value.units import ExportUnitSystem
from features.project_document.models import ProjectDocumentSource
from features.project_document.store import load_document_body
from features.projects.access import (
    ProjectAccess,
    require_capability,
    require_project_view_access,
)
from features.shared.responses import (
    csv_download_response,
    download_filename_part,
    xlsx_download_response,
)

router = APIRouter(
    prefix="/api/v1/projects/{project_id}/versions/{version_id}",
    tags=["aperture-u-value"],
)

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]


@router.get("/apertures/u-values", response_model=AperturesUValueListResponse)
def get_aperture_u_values(
    project_id: UUID,
    version_id: UUID,
    access: ProjectViewAccess,
    source: Annotated[ProjectDocumentSource, Query(pattern=r"^(draft|version)$")] = "draft",
) -> AperturesUValueListResponse:
    del project_id  # Path arg only — access carries the project id.
    body = load_document_body(version_id, access, source)
    results = [calculate_aperture_u_values(entry, body.tables) for entry in body.tables.apertures]
    return AperturesUValueListResponse(
        project_id=access.project_id,
        version_id=version_id,
        source=source,
        apertures=results,
    )


@router.get("/apertures/u-values/report", response_model=ApertureUValueReport)
def get_aperture_u_value_report(
    project_id: UUID,
    version_id: UUID,
    access: ProjectViewAccess,
    source: Annotated[ProjectDocumentSource, Query(pattern=r"^(draft|version)$")] = "draft",
) -> ApertureUValueReport:
    """Return fresh, name-bearing audit detail for every aperture type."""
    del project_id  # Path arg only — access carries the project id.
    return get_report(
        version_id=version_id,
        access=access,
        source=source,
    )


@router.get("/apertures/u-values/report/export")
def export_aperture_u_value_report(
    project_id: UUID,
    version_id: UUID,
    access: ProjectViewAccess,
    export_format: Annotated[Literal["csv", "xlsx"], Query(alias="format")],
    units: Annotated[ExportUnitSystem, Query()] = "IP",
) -> Response:
    """Export the saved-version report as raw CSV or a formula workbook."""
    del project_id  # Path arg only — access carries the project id.
    require_capability(access, APERTURE_EXPORT_U_VALUE_REPORT)
    report = get_report(
        version_id=version_id,
        access=access,
        source="version",
    )
    filename = _report_filename(
        report.provenance.bt_number,
        report.provenance.version_label,
        units,
        export_format,
    )
    if export_format == "csv":
        return csv_download_response(
            render_aperture_u_value_csv(report, units=units),
            filename,
        )
    return xlsx_download_response(
        render_aperture_u_value_xlsx(
            report,
            units=units,
            generated_at=datetime.now(UTC),
        ),
        filename,
    )


def _report_filename(
    bt_number: str,
    version_label: str,
    units: ExportUnitSystem,
    extension: Literal["csv", "xlsx"],
) -> str:
    bt_slug = download_filename_part(bt_number, "project")
    version_slug = download_filename_part(version_label, "version")
    return f"{bt_slug}-aperture-u-values-{units}-{version_slug}.{extension}"
