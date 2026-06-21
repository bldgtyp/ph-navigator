"""API wire contracts for project-scoped climate sources.

A *source* records "this project evaluates climate basis X" (D-CL-4): a
pinned Phius/PHI reference-dataset location, an ASHRAE station pointer, the
project EPW, or a custom standardized record. The interpretation of
``ref`` / ``data`` depends on ``kind`` (see the migration); presence rules
are enforced here, while existence checks (the referenced location/asset
actually exists) live in the service where the DB is in scope.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

ClimateSourceKind = Literal["phius", "phi", "ashrae", "epw", "custom"]

# Kinds that point at something by ``ref`` rather than carrying a record.
_REF_KINDS: frozenset[str] = frozenset({"phius", "phi", "ashrae", "epw"})
# Kinds permitted to carry a ``data`` payload. Phius/PHI store derived
# proximity metadata when auto-attached from the project location derive flow.
_DATA_KINDS: frozenset[str] = frozenset({"custom", "ashrae", "phius", "phi"})


class ProjectClimateSourcePublic(BaseModel):
    """One attached climate source for a project."""

    model_config = ConfigDict(extra="ignore")

    id: UUID
    project_id: UUID
    kind: ClimateSourceKind
    ref: str | None
    label: str | None
    is_default: bool
    data: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class ProjectClimateSourceListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ProjectClimateSourcePublic]


class CreateProjectClimateSourceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: ClimateSourceKind
    ref: Annotated[str | None, Field(max_length=500)] = None
    label: Annotated[str | None, Field(max_length=200)] = None
    is_default: bool = False
    data: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _check_shape(self) -> CreateProjectClimateSourceRequest:
        validate_source_shape(self.kind, self.ref, self.data)
        return self


class UpdateProjectClimateSourceRequest(BaseModel):
    """Partial update — ``kind`` is immutable; default is toggled separately."""

    model_config = ConfigDict(extra="forbid")

    label: Annotated[str | None, Field(max_length=200)] = None
    ref: Annotated[str | None, Field(max_length=500)] = None
    data: dict[str, Any] | None = None


def validate_source_shape(kind: str, ref: str | None, data: dict[str, Any] | None) -> None:
    """Enforce the ref/data presence rules for a source ``kind``.

    Shape only — that a referenced location or asset actually exists is a
    service-layer (DB) concern. Raises ``ValueError`` so it surfaces as a
    422 both from Pydantic validation (create) and from the service (the
    merged shape after a partial update).
    """
    if kind == "custom":
        if data is None:
            raise ValueError("custom climate source requires a `data` record.")
        if ref is not None:
            raise ValueError("custom climate source must not set `ref`.")
        return
    if kind in _REF_KINDS and not (ref and ref.strip()):
        raise ValueError(f"{kind} climate source requires a `ref`.")
    if kind not in _DATA_KINDS and data is not None:
        raise ValueError(f"{kind} climate source must not carry `data`.")
