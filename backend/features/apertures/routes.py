"""Aperture product report read routes."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from features.apertures.models import ApertureSpecReportResponse
from features.apertures.service import get_aperture_spec_report
from features.project_document.models import ProjectDocumentSource
from features.projects.access import ProjectAccess, require_project_view_access

router = APIRouter(
    prefix="/api/v1/projects/{project_id}/versions/{version_id}",
    tags=["apertures"],
)

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]


@router.get("/apertures/spec-report", response_model=ApertureSpecReportResponse)
def get_apertures_spec_report(
    version_id: UUID,
    access: ProjectViewAccess,
    source: Annotated[ProjectDocumentSource, Query()] = "draft",
) -> ApertureSpecReportResponse:
    return get_aperture_spec_report(version_id, access, source)
