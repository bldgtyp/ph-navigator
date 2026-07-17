"""Contracts for project-wide catalog option cascades."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

CatalogOptionJobStatus = Literal["pending", "running", "completed", "failed"]
CatalogOptionOperationKind = Literal["rename", "merge"]
CatalogOptionTable = Literal["frame_types", "glazing_types"]


class CatalogOptionOperation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    kind: CatalogOptionOperationKind
    old_label: str = Field(min_length=1, max_length=200)
    new_label: str = Field(min_length=1, max_length=200)


class CatalogOptionCascadePreviewRequest(BaseModel):
    """The client-side confirmation asks how many active projects a change reaches."""

    model_config = ConfigDict(extra="forbid")

    catalog_table: CatalogOptionTable
    field_key: str
    operations: list[CatalogOptionOperation] = Field(min_length=1)


class CatalogOptionCascadePreview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_count: int


class CatalogOptionProjectResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    project_name: str
    status: CatalogOptionJobStatus
    refs_rewritten: int = 0
    filters_rewritten: int = 0
    drafts_rewritten: int = 0
    version_created: bool = False
    error: str | None = None


class CatalogOptionCascadeTotals(BaseModel):
    model_config = ConfigDict(extra="forbid")

    projects_touched: int = 0
    refs_rewritten: int = 0
    filters_rewritten: int = 0
    drafts_rewritten: int = 0
    versions_created: int = 0
    failures: int = 0


class CatalogOptionJob(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    catalog_table: CatalogOptionTable
    field_key: str
    status: CatalogOptionJobStatus
    progress: int
    created_by: UUID
    operations: list[CatalogOptionOperation]
    total_projects: int
    processed_projects: int
    current_project_id: UUID | None
    project_results: list[CatalogOptionProjectResult] = Field(default_factory=list)
    result: CatalogOptionCascadeTotals
    error: str | None
    created_at: datetime
    started_at: datetime | None
    heartbeat_at: datetime | None
    finished_at: datetime | None
