"""Request/response contracts for HBJSON construction import.

Kept out of ``models.py`` so the large ``EnvelopeCommand`` module stays
focused; ``models.py`` imports only :class:`ConstructionResolution` (the
one type the apply command carries). The preview response models are read
by the route and never participate in the command union.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.models import ProjectDocumentSource

# Per-construction collision action (PRD §6 / D5). ``replace`` swaps an
# existing assembly in place; ``add_new`` appends (name auto-suffixed on
# collision); ``skip`` drops the construction from the import.
ConstructionAction = Literal["add_new", "replace", "skip"]

# How one incoming material resolved against the project + catalog (PRD §5
# rungs 1–3 & 6; name/property rungs 4–5 arrive in Phase 2).
MaterialDecision = Literal[
    "reuse_project_material",
    "reuse_catalog_in_project",
    "pick_from_catalog",
    "create_new",
]


class ConstructionResolution(BaseModel):
    """User (or default) decision for one incoming construction.

    Keyed by ``resolution_key`` (the file's construction identifier) so foreign
    constructions — which carry no native assembly id — can be addressed too.
    """

    model_config = ConfigDict(extra="forbid")

    resolution_key: str
    action: ConstructionAction
    target_assembly_id: str | None = None


# Material decisions are otherwise deterministic; the only override is "reject
# the match and create a fresh project-only copy" — the false-positive
# name-match escape hatch.
MaterialOverrideAction = Literal["create_new"]


class MaterialResolution(BaseModel):
    """User override for one incoming material, keyed by its ``source_key``."""

    model_config = ConfigDict(extra="forbid")

    source_key: str
    action: MaterialOverrideAction = "create_new"


class MaterialPlanItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_key: str
    name: str
    decision: MaterialDecision
    project_material_id: str
    catalog_record_id: str | None = None
    warnings: list[str] = Field(default_factory=list)


class ConstructionPlanItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resolution_key: str
    source_assembly_id: str | None
    name: str
    action: ConstructionAction
    target_assembly_id: str | None = None
    warnings: list[str] = Field(default_factory=list)


class ImportPlanCounts(BaseModel):
    model_config = ConfigDict(extra="forbid")

    constructions_add: int = 0
    constructions_replace: int = 0
    constructions_skip: int = 0
    materials_reused: int = 0
    materials_picked_from_catalog: int = 0
    materials_created: int = 0


class ImportConstructionsPreviewResponse(BaseModel):
    """Dry-run plan returned by the preview route; no document mutation."""

    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    schema_version: int
    constructions: list[ConstructionPlanItem] = Field(default_factory=list)
    materials: list[MaterialPlanItem] = Field(default_factory=list)
    counts: ImportPlanCounts = Field(default_factory=ImportPlanCounts)
    warnings: list[str] = Field(default_factory=list)
