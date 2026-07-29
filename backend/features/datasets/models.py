"""Typed contracts for published and applied licensed datasets."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

DatasetKind = Literal["runtime_read", "db_seed"]
DatasetMismatch = Literal[
    "checksum_mismatch",
    "code_ahead_of_data",
    "data_ahead_of_code",
    "runtime_version_mismatch",
    "unapplied_pending",
]


class PublishedDataset(BaseModel):
    """One immutable object pointer from the published manifest."""

    model_config = ConfigDict(extra="forbid")

    version: str = Field(pattern=r"^[1-9][0-9]*$")
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    key: str = Field(min_length=1)


class DatasetManifest(BaseModel):
    """Published pointer set uploaded after every immutable dataset object."""

    model_config = ConfigDict(extra="forbid")

    generated_at: datetime
    datasets: dict[str, PublishedDataset]

    @model_validator(mode="after")
    def _keys_match_entries(self) -> DatasetManifest:
        for slug, entry in self.datasets.items():
            if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug) is None:
                raise ValueError("dataset slugs must be stable kebab-case")
            expected = f"datasets/{slug}/{entry.version}/dataset.json"
            if entry.key != expected:
                raise ValueError(f"dataset {slug!r} must use its versioned key")
        return self


class ApplyReport(BaseModel):
    """Target-row outcomes returned by one idempotent dataset applier."""

    model_config = ConfigDict(extra="forbid")

    matched: int = Field(default=0, ge=0)
    updated: int = Field(default=0, ge=0)
    unchanged: int = Field(default=0, ge=0)
    unmatched: tuple[str, ...] = ()


class AppliedDatasetRecord(BaseModel):
    """Audit row recording one successfully applied immutable version."""

    model_config = ConfigDict(extra="forbid")

    slug: str
    version: str
    sha256: str
    applied_at: datetime
    applied_by: str


class DatasetApplyResult(BaseModel):
    """Safe CLI result for one applied dataset."""

    model_config = ConfigDict(extra="forbid")

    slug: str
    version: str
    sha256: str
    report: ApplyReport


class DatasetStatusItem(BaseModel):
    """Published/applied-or-loaded comparison for one manifest or registry slug."""

    model_config = ConfigDict(extra="forbid")

    slug: str
    kind: DatasetKind | None
    published_version: str | None
    applied_or_loaded_version: str | None
    sha256: str | None
    mismatches: tuple[DatasetMismatch, ...] = ()


class DatasetStatusSummary(BaseModel):
    """Complete registry/manifest reconciliation."""

    model_config = ConfigDict(extra="forbid")

    items: tuple[DatasetStatusItem, ...]
