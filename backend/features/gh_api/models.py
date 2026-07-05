"""Wire-contract models for the Grasshopper Data API.

The `schema_version` here is the **GH wire-contract version** — independent of
the project document's `schema_version`. Bump it only with a compatibility note
for the plugin side (see `planning/archive/dated/2026-07-05/grasshopper-data-api/PLAN.md`).

Timestamps serialize as UTC ISO-8601 with a `Z` suffix. `last_modified` is the
version's save timestamp and is byte-stable for a given version; the Rhino
client keys change-detection on it, so the value must not wobble.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, PlainSerializer

from features.projects.models import VersionKind

GH_SCHEMA_VERSION = 1


def _iso_utc_z(value: datetime) -> str:
    """Render a timestamp as UTC ISO-8601 with a `Z` suffix (`...T00:00:00Z`)."""
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


# Timestamps crossing the GH wire always use this shape so the IronPython client
# parses one consistent format.
IsoUtcZ = Annotated[datetime, PlainSerializer(_iso_utc_z, return_type=str)]


class GhProjectInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bt_number: str
    project_id: UUID
    name: str


class GhWarning(BaseModel):
    """A non-fatal note a GH route attaches to its envelope (surfaced client-side
    as an `IGH.warning`).

    Route-agnostic on purpose: it mirrors the error-envelope shape (`code` +
    `message` + a free-form `details` bag) so the *shared* `GhEnvelope` can carry
    warnings from any route without growing route-specific fields, and the GH
    client's existing error-`details` renderer handles them unchanged. The only
    producer today is the constructions export (`on_missing_thermal=user_defaults`,
    see `constructions_export.py`).
    """

    model_config = ConfigDict(extra="forbid")

    code: str
    message: str
    details: dict[str, Any] = {}


class GhEnvelope(BaseModel):
    """Common envelope every GH route returns; payload keys are added by subclasses."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1] = GH_SCHEMA_VERSION
    project: GhProjectInfo
    version_id: UUID
    last_modified: IsoUtcZ
    warnings: list[GhWarning] = []


class GhVersionInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version_id: UUID
    saved_at: IsoUtcZ
    name: str
    kind: VersionKind


class GhResolverResponse(GhEnvelope):
    """`GET /api/v1/gh/projects/{bt_number}` — project info + saved-version list."""

    versions: list[GhVersionInfo]


class GhConstructionsResponse(GhEnvelope):
    """`GET /constructions/hbjson` — rich `OpaqueConstruction.to_dict()` by assembly name."""

    hb_constructions: dict[str, dict[str, Any]]


class GhApertureTypesResponse(GhEnvelope):
    """`GET /aperture-types` — denormalized aperture-grid JSON by type name."""

    aperture_types: dict[str, dict[str, Any]]


class GhApertureConstructionsResponse(GhEnvelope):
    """`GET /aperture-constructions/hbjson` — `WindowConstruction.to_dict()` by element id."""

    hb_constructions: dict[str, dict[str, Any]]


class GhTableResponse(GhEnvelope):
    """`GET /tables/{table_name}` — one element table's rows + field definitions."""

    field_defs: list[dict[str, Any]]
    records: list[dict[str, Any]]
