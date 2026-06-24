"""Pydantic contracts for aperture product report pages."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.aperture_commands.models import ApertureSide
from features.project_document.document import ProjectFrame, ProjectGlazing
from features.project_document.models import ProjectDocumentSource


class ProjectGlazingUseSite(BaseModel):
    """Derived reference from an aperture element back to its project glazing."""

    model_config = ConfigDict(extra="forbid")

    aperture_type_id: str
    aperture_type_name: str
    element_id: str
    element_name: str


class ProjectFrameUseSite(BaseModel):
    """Derived reference from a frame slot back to its project frame."""

    model_config = ConfigDict(extra="forbid")

    aperture_type_id: str
    aperture_type_name: str
    element_id: str
    element_name: str
    side: ApertureSide


class ProjectGlazingRead(ProjectGlazing):
    """Project glazing document row plus derived aperture use-sites."""

    use_sites: list[ProjectGlazingUseSite] = Field(default_factory=list)


class ProjectFrameRead(ProjectFrame):
    """Project frame document row plus derived aperture use-sites."""

    use_sites: list[ProjectFrameUseSite] = Field(default_factory=list)


class ApertureSpecReportResponse(BaseModel):
    """Aperture product report read model for Glazings and Frames pages."""

    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    project_glazings: list[ProjectGlazingRead] = Field(default_factory=list)
    project_frames: list[ProjectFrameRead] = Field(default_factory=list)
