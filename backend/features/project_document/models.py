"""Pydantic contracts for project-document workflows."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.document import ProjectDocumentV1
from features.projects.models import ProjectVersionPublic, VersionKind

ProjectDocumentSource = Literal["version", "draft"]
DiffTarget = Literal["draft"]
AUTO_LOCKED_VERSION_KINDS: frozenset[VersionKind] = frozenset({"submitted", "closed"})


class ProjectDocumentView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    body: ProjectDocumentV1


class SaveDraftResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version: ProjectVersionPublic
    version_etag: str


class SaveAsDraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    kind: VersionKind = "working"
    locked: bool = False


class DiscardDraftResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    discarded: bool


class VersionPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    locked: bool | None = None
    make_active: bool | None = None


class TableDiffSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    table: str
    change_count: int
    changed_paths: list[str]


class ProjectDiffResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    from_version_id: UUID
    to_version_id: UUID | DiffTarget
    tables: list[TableDiffSummary]
