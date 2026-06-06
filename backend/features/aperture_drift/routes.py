"""REST endpoint for the per-project aperture drift report.

``GET /api/v1/projects/{id}/versions/{vid}/apertures/drift-report?source=draft|version``
returns ``ApertureDriftReport`` over the chosen body. The catalog
reader hits the catalog repositories directly so the detector stays
pure and unit-testable with a stub.
"""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from database import connection
from features.aperture_drift.detector import detect_aperture_drift
from features.aperture_drift.models import ApertureDriftReport
from features.catalogs.frame_types import repository as frame_repo
from features.catalogs.glazing_types import repository as glazing_repo
from features.project_document.store import (
    get_current_document_view,
    get_saved_document,
)
from features.projects.access import ProjectAccess, require_project_view_access

router = APIRouter(
    prefix="/api/v1/projects/{project_id}/versions/{version_id}",
    tags=["aperture-drift"],
)

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]


class _LiveCatalogReader:
    """Repository-backed reader used by the route.

    Each lookup opens a short-lived connection; the drift report is
    typically called once per page-load and the lookups are per-record,
    so connection churn is acceptable for v1.
    """

    def get_frame_type(self, record_id: str) -> dict[str, Any] | None:
        with connection() as conn:
            return frame_repo.get_frame_type(conn, record_id)

    def get_glazing_type(self, record_id: str) -> dict[str, Any] | None:
        with connection() as conn:
            return glazing_repo.get_glazing_type(conn, record_id)


@router.get("/apertures/drift-report", response_model=ApertureDriftReport)
def get_aperture_drift_report(
    project_id: UUID,
    version_id: UUID,
    access: ProjectViewAccess,
    source: Annotated[str, Query(pattern=r"^(draft|version)$")] = "draft",
) -> ApertureDriftReport:
    del project_id  # access carries the resolved project id
    body = (
        get_current_document_view(version_id, access).body
        if source == "draft"
        else get_saved_document(version_id, access)
    )
    return detect_aperture_drift(body, _LiveCatalogReader())
