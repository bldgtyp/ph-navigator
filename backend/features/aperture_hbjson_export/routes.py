"""REST endpoint serving the HBJSON window-constructions export.

``GET /api/v1/projects/{id}/versions/{vid}/apertures/hbjson?source=draft|version``
returns the V1-shaped payload directly — a JSON object keyed by
escaped aperture-element identifier, each value a
``WindowConstruction.to_dict()`` shape. The Rhino / honeybee_ph
component side rebuilds via ``WindowConstruction.from_dict``.

Both ``draft`` and ``version`` sources require view access; the export
is read-only against the document body. Viewers can fetch via REST
(the frontend hides the action for Viewer mode in v1 — see PRD §17).
"""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from features.aperture_hbjson_export.service import export_aperture_window_constructions
from features.project_document.models import ProjectDocumentSource
from features.project_document.store import load_document_body
from features.projects.access import (
    ProjectAccess,
    require_project_view_access,
)

router = APIRouter(
    prefix="/api/v1/projects/{project_id}/versions/{version_id}",
    tags=["aperture-hbjson-export"],
)

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]


@router.get("/apertures/hbjson")
def get_aperture_window_constructions_hbjson(
    project_id: UUID,
    version_id: UUID,
    access: ProjectViewAccess,
    source: Annotated[ProjectDocumentSource, Query(pattern=r"^(draft|version)$")] = "draft",
) -> dict[str, dict[str, Any]]:
    del project_id  # Path arg only — access carries the project id.
    body = load_document_body(version_id, access, source)
    return export_aperture_window_constructions(body)
