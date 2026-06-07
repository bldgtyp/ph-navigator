"""REST endpoint for the per-project aperture drift report.

``GET /api/v1/projects/{id}/versions/{vid}/apertures/drift-report?source=draft|version``
returns ``ApertureDriftReport`` over the chosen body. The catalog
reader hits the catalog repositories directly so the detector stays
pure and unit-testable with a stub.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from features.aperture_drift.detector import detect_aperture_drift
from features.aperture_drift.models import ApertureDriftReport
from features.aperture_drift.reader import LiveCatalogReader
from features.project_document.models import ProjectDocumentSource
from features.project_document.store import load_document_body
from features.projects.access import ProjectAccess, require_project_view_access

router = APIRouter(
    prefix="/api/v1/projects/{project_id}/versions/{version_id}",
    tags=["aperture-drift"],
)

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]


@router.get("/apertures/drift-report", response_model=ApertureDriftReport)
def get_aperture_drift_report(
    project_id: UUID,
    version_id: UUID,
    access: ProjectViewAccess,
    source: Annotated[ProjectDocumentSource, Query(pattern=r"^(draft|version)$")] = "draft",
) -> ApertureDriftReport:
    del project_id  # access carries the resolved project id
    body = load_document_body(version_id, access, source)
    return detect_aperture_drift(body, LiveCatalogReader())
