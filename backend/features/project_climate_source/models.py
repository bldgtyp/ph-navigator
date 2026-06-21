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

from features.climate.proximity import ClimateProximityVerdict

ClimateSourceKind = Literal["phius", "phi", "ashrae", "epw", "custom"]
AshraeVersion = Literal["2009", "2013", "2017", "2021", "2025"]

# Kinds that point at something by ``ref`` rather than carrying a record.
_REF_KINDS: frozenset[str] = frozenset({"phius", "phi", "ashrae", "epw"})
# Kinds permitted to carry a ``data`` payload. Dataset and EPW pointers cache
# small certification-load-bearing metadata when auto-attached.
_DATA_KINDS: frozenset[str] = frozenset({"custom", "ashrae", "epw", "phius", "phi"})


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


class RefreshAshraeDesignConditionsRequest(BaseModel):
    """On-demand current-edition ASHRAE pull for the project location."""

    model_config = ConfigDict(extra="forbid")

    ashrae_version: AshraeVersion = "2025"


# --- Dataset picker roster (project-scoped feed for manual attach) ---------
#
# The authoritative feed the climate dataset picker renders: a PH dataset's
# candidate stations for a project, each with backend-computed proximity,
# sorted nearest-first (D-DP-2). Distinct from the app-wide
# ``climate_dataset_location`` listing, which knows nothing about a project.


class ClimateDatasetRef(BaseModel):
    """Identity of the pinned reference dataset a roster is drawn from."""

    model_config = ConfigDict(extra="ignore")

    id: UUID
    provider: str
    version: str
    label: str | None


class RosterProjectLocation(BaseModel):
    """The project's site — the origin every roster distance is measured from."""

    model_config = ConfigDict(extra="forbid")

    latitude: float
    longitude: float
    elevation_m: float | None
    state: str | None


class ClimateDatasetRosterItem(BaseModel):
    """One candidate station with its proximity verdict against the project."""

    model_config = ConfigDict(extra="ignore")

    id: UUID
    name: str
    station_id: str | None
    latitude: float | None
    longitude: float | None
    elevation_m: float | None
    climate_zone: str | None
    proximity: ClimateProximityVerdict


class ClimateDatasetRosterResponse(BaseModel):
    """The picker feed: the dataset, the project origin, and stations nearest-first.

    ``dataset`` is null when the kind has no seeded dataset yet (e.g. PHI in
    dev) so the modal can show an empty state rather than treating it as an error.
    """

    model_config = ConfigDict(extra="forbid")

    dataset: ClimateDatasetRef | None
    project: RosterProjectLocation
    items: list[ClimateDatasetRosterItem]
    total: int


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
