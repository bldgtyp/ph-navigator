"""Assembly Builder read and command routes."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query

from features.envelope.models import EnvelopeCommandRequest, EnvelopeReadResponse
from features.envelope.service import apply_envelope_command, get_envelope_read_model
from features.project_document.models import ProjectDocumentSource
from features.projects.access import ProjectAccess, require_project_edit_access, require_project_view_access

router = APIRouter(
    prefix="/api/v1/projects/{project_id}/versions/{version_id}",
    tags=["envelope"],
)

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


@router.get("/envelope", response_model=EnvelopeReadResponse)
def get_envelope(
    version_id: UUID,
    access: ProjectViewAccess,
    source: Annotated[ProjectDocumentSource, Query()] = "draft",
) -> EnvelopeReadResponse:
    return get_envelope_read_model(version_id, access, source)


@router.post("/draft/envelope/commands", response_model=EnvelopeReadResponse)
def post_envelope_command(
    version_id: UUID,
    payload: EnvelopeCommandRequest,
    access: ProjectEditAccess,
    if_match: Annotated[str | None, Header()] = None,
    if_match_version: Annotated[str | None, Header()] = None,
) -> EnvelopeReadResponse:
    return apply_envelope_command(
        version_id,
        access,
        payload.command,
        if_match=if_match,
        if_match_version=if_match_version,
    )
