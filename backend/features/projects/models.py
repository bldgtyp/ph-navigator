"""Pydantic contracts for projects and saved versions."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

CertificationProgram = Literal["phi", "phius"]
VersionKind = Literal["working", "submitted", "closed", "snapshot"]
AccessMode = Literal["editor", "viewer"]


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
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("bt_number")
    @classmethod
    def bt_number_required_after_strip(cls, value: str | None) -> str:
        if not value:
            raise ValueError("BT number is required.")
        return value

    @field_validator("name")
    @classmethod
    def name_required_after_strip(cls, value: str | None) -> str:
        if not value:
            raise ValueError("Project name is required.")
        return value

    @field_validator("cert_programs")
    @classmethod
    def cert_programs_unique(cls, value: list[CertificationProgram]) -> list[CertificationProgram]:
        seen: set[CertificationProgram] = set()
        result: list[CertificationProgram] = []
        for program in value:
            if program not in seen:
                seen.add(program)
                result.append(program)
        return result


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
    bt_number: str
    client: str | None
    cert_programs: list[CertificationProgram]
    phius_number: str | None
    phius_dropbox_url: str | None
    active_version_id: UUID | None
    last_saved_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ProjectDetail(ProjectSummary):
    versions: list[ProjectVersionPublic]
    active_version: ProjectVersionPublic | None
    access_mode: AccessMode


class ProjectListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    projects: list[ProjectSummary]


class BtNumberConflict(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    name: str


class BtNumberAvailabilityResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    available: bool
    conflict: BtNumberConflict | None = None
