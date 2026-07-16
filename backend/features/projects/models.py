"""Pydantic contracts for projects and saved versions."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from features.shared.models import strip_blank_string

CertificationProgram = Literal["phi", "phius"]
VersionKind = Literal["working", "submitted", "closed", "snapshot"]
AccessMode = Literal["editor", "viewer"]


def _require_project_name(value: str | None) -> str:
    if not value:
        raise ValueError("Project name is required.")
    return value


def _require_bt_number(value: str | None) -> str:
    if not value:
        raise ValueError("BT number is required.")
    return value


def _dedupe_cert_programs(value: list[CertificationProgram]) -> list[CertificationProgram]:
    seen: set[CertificationProgram] = set()
    result: list[CertificationProgram] = []
    for program in value:
        if program not in seen:
            seen.add(program)
            result.append(program)
    return result


class CreateProjectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    bt_number: str = Field(min_length=1, max_length=64)
    client: str | None = Field(default=None, max_length=200)
    cert_programs: list[CertificationProgram] = Field(default_factory=list)
    phius_number: str | None = Field(default=None, max_length=100)
    phius_dropbox_url: str | None = Field(default=None, max_length=500)

    @field_validator("name", "bt_number", "client", "phius_number", "phius_dropbox_url", mode="before")
    @classmethod
    def strip_blank_strings(cls, value: object) -> object:
        return strip_blank_string(value)

    @field_validator("bt_number")
    @classmethod
    def bt_number_required_after_strip(cls, value: str | None) -> str:
        return _require_bt_number(value)

    @field_validator("name")
    @classmethod
    def name_required_after_strip(cls, value: str | None) -> str:
        return _require_project_name(value)

    @field_validator("cert_programs")
    @classmethod
    def cert_programs_unique(cls, value: list[CertificationProgram]) -> list[CertificationProgram]:
        return _dedupe_cert_programs(value)


class UpdateProjectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    bt_number: str | None = Field(default=None, min_length=1, max_length=64)
    client: str | None = Field(default=None, max_length=200)
    public_alias: str | None = Field(default=None, max_length=200)
    cert_programs: list[CertificationProgram] | None = None
    phius_number: str | None = Field(default=None, max_length=100)
    phius_dropbox_url: str | None = Field(default=None, max_length=500)

    @field_validator("name", "bt_number", "client", "public_alias", "phius_number", "phius_dropbox_url", mode="before")
    @classmethod
    def strip_blank_strings(cls, value: object) -> object:
        return strip_blank_string(value)

    @model_validator(mode="after")
    def required_fields_cannot_be_cleared(self) -> Self:
        if "name" in self.model_fields_set:
            self.name = _require_project_name(self.name)
        if "bt_number" in self.model_fields_set:
            self.bt_number = _require_bt_number(self.bt_number)
        if "cert_programs" in self.model_fields_set and self.cert_programs is None:
            raise ValueError("Certification programs must be a list.")
        return self

    @field_validator("cert_programs")
    @classmethod
    def cert_programs_unique(cls, value: list[CertificationProgram] | None) -> list[CertificationProgram] | None:
        if value is None:
            return value
        return _dedupe_cert_programs(value)

    @field_validator("phius_dropbox_url")
    @classmethod
    def phius_dropbox_url_must_be_http(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not (value.startswith("http://") or value.startswith("https://")):
            raise ValueError("Dropbox URL must start with http:// or https://.")
        return value


class ProjectVersionPublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    project_id: UUID
    name: str
    kind: VersionKind
    locked: bool
    schema_version: int
    body_size_bytes: int
    created_at: datetime
    updated_at: datetime


class ProjectSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    name: str
    public_alias: str | None
    bt_number: str
    client: str | None
    cert_programs: list[CertificationProgram]
    phius_number: str | None
    phius_dropbox_url: str | None
    active_version_id: UUID | None
    last_saved_at: datetime | None
    created_at: datetime
    updated_at: datetime
    # The public-facing title: the alias if set, else the internal name. Always
    # server-derived by `_derive_display_name` (any supplied value is ignored),
    # so every title site and every API/MCP consumer shares one resolution rule.
    # A plain field — not a computed property — so it appears in both the
    # validation and serialization JSON schemas (FastMCP validates tool output
    # against the former). For a `client` viewer the internal `name` is itself
    # redacted to the alias in `service.get_project_detail`, so `display_name`
    # and `name` coincide there and the real name never reaches them.
    display_name: str = ""

    @model_validator(mode="after")
    def _derive_display_name(self) -> Self:
        self.display_name = self.public_alias or self.name
        return self


class ProjectDetail(ProjectSummary):
    versions: list[ProjectVersionPublic]
    active_version: ProjectVersionPublic | None
    access_mode: AccessMode
    owner_display_name: str | None = None


class ProjectListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    projects: list[ProjectSummary]


ProjectDeleteMode = Literal["soft"]


class ProjectDeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirm: bool = False


class ProjectDeleteCounts(BaseModel):
    model_config = ConfigDict(extra="forbid")

    versions: int = 0
    drafts: int = 0
    status_items: int = 0
    assets: int = 0
    jobs: int = 0
    mcp_tokens: int = 0
    table_views: int = 0


class ProjectDeletedSummary(ProjectSummary):
    deleted_at: datetime
    deleted_by: UUID | None
    hard_delete_after: datetime | None
    counts: ProjectDeleteCounts


class ProjectDeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    mode: ProjectDeleteMode = "soft"
    deleted_at: datetime
    hard_delete_after: datetime | None
    already_deleted: bool = False
    counts: ProjectDeleteCounts


class ProjectBulkDeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_ids: list[UUID] = Field(min_length=1, max_length=100)
    confirm: bool = False


class ProjectBulkDeleteItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    ok: bool
    deleted_at: datetime | None = None
    hard_delete_after: datetime | None = None
    already_deleted: bool = False
    counts: ProjectDeleteCounts | None = None
    error_code: str | None = None
    message: str | None = None


class ProjectBulkDeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: ProjectDeleteMode = "soft"
    items: list[ProjectBulkDeleteItem]


class ProjectDeletedListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    projects: list[ProjectDeletedSummary]


class ProjectHardDeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirm_project_name: str = Field(min_length=1)
    confirm_bt_number: str = Field(min_length=1)


class ProjectHardDeleteStorageSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    deleted_object_count: int = 0
    failed_object_keys: list[str] = Field(default_factory=list)


class ProjectHardDeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    deleted: bool
    counts: ProjectDeleteCounts
    storage: ProjectHardDeleteStorageSummary
    manifest: dict[str, object]


class BtNumberConflict(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    name: str


class BtNumberAvailabilityResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    available: bool
    conflict: BtNumberConflict | None = None
