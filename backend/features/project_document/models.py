"""Pydantic contracts for project-document workflows."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.document import CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION, ProjectDocumentV1
from features.projects.models import ProjectVersionPublic, VersionKind

ProjectDocumentSource = Literal["version", "draft"]
DiffTarget = Literal["draft"]
AUTO_LOCKED_VERSION_KINDS: frozenset[VersionKind] = frozenset({"submitted", "closed"})
ReadSafeErrorCode = Literal["schema_migration_failed", "schema_validation_failed_after_migration"]


class ProjectDocumentView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    body: ProjectDocumentV1


class ProjectDocumentReadSafeEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    schema_version: int | None
    current_schema_version: int = CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
    schema_version_unsupported: Literal[True] = True
    error_code: ReadSafeErrorCode
    message: str
    request_id: str
    validation_errors: list[str]
    body: Any


class ProjectDraftSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    dirty_tables: list[str]
    last_patched_at: datetime | None
    is_locked: bool
    can_edit: bool


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
