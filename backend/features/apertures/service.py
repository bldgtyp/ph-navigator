"""Aperture report read workflows."""

from __future__ import annotations

from uuid import UUID

from features.apertures.models import ApertureSpecReportResponse
from features.apertures.selectors import build_apertures_read_parts
from features.project_document.models import ProjectDocumentSource
from features.project_document.service import document_etag, get_current_document_view, get_saved_document
from features.projects.access import ProjectAccess


def get_aperture_spec_report(
    version_id: UUID,
    access: ProjectAccess,
    source: ProjectDocumentSource,
) -> ApertureSpecReportResponse:
    """Return derived glazing/frame report rows without mutating the document."""
    if source == "version":
        body = get_saved_document(version_id, access)
        project_glazings, project_frames = build_apertures_read_parts(body)
        return ApertureSpecReportResponse(
            project_id=access.project_id,
            version_id=version_id,
            source="version",
            version_etag=document_etag(body),
            draft_etag=None,
            project_glazings=project_glazings,
            project_frames=project_frames,
        )

    view = get_current_document_view(version_id, access)
    project_glazings, project_frames = build_apertures_read_parts(view.body)
    return ApertureSpecReportResponse(
        project_id=access.project_id,
        version_id=version_id,
        source=view.source,
        version_etag=view.version_etag,
        draft_etag=view.draft_etag,
        project_glazings=project_glazings,
        project_frames=project_frames,
    )
