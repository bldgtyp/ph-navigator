"""REST endpoint exposing per-aperture composite U-Values.

``GET /api/v1/projects/{id}/versions/{vid}/apertures/u-values?source=draft|version``
returns a list of ``ApertureUValueResult`` (one per aperture type in
the document). The service caches each result by content hash, so a
no-op refetch is essentially free.

Authorization mirrors the document slice routes: ``draft`` requires
edit access, ``version`` requires view access.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from features.aperture_u_value.models import AperturesUValueListResponse
from features.aperture_u_value.service import calculate_aperture_u_values
from features.project_document.store import (
    get_current_document_view,
    get_saved_document,
)
from features.projects.access import (
    ProjectAccess,
    require_project_view_access,
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
    source: Annotated[str, Query(pattern=r"^(draft|version)$")] = "draft",
) -> AperturesUValueListResponse:
    del project_id  # Path arg only — access carries the project id.
    if source == "draft":
        body = get_current_document_view(version_id, access).body
    else:
        body = get_saved_document(version_id, access)
    results = [calculate_aperture_u_values(entry) for entry in body.tables.apertures]
    return AperturesUValueListResponse(
        project_id=access.project_id,
        version_id=version_id,
        source="draft" if source == "draft" else "version",
        apertures=results,
    )
