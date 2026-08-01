"""Pydantic contracts for MCP token administration and tool output."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal, TypeAlias
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from features.project_status.models import StatusItemPublic
from features.projects.models import ProjectSummary, ProjectVersionPublic

McpScope = Literal["project:read", "project:write", "asset:read", "asset:write"]
McpRecoverability = Literal["retry", "refresh", "reauthenticate", "forbidden", "fatal"]
McpDeviceAuthorizationStatus = Literal["pending", "approved", "denied", "expired", "redeemed"]
READ_ONLY_SCOPES: tuple[McpScope, ...] = ("project:read",)
ALL_MCP_SCOPES: tuple[McpScope, ...] = ("project:read", "project:write", "asset:read", "asset:write")


class McpTokenGrantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=1, max_length=120)
    scopes: list[McpScope] = Field(default_factory=lambda: list(READ_ONLY_SCOPES), min_length=1)

    @field_validator("label", mode="before")
    @classmethod
    def strip_label(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("scopes")
    @classmethod
    def scopes_unique(cls, value: list[McpScope]) -> list[McpScope]:
        seen: set[McpScope] = set()
        result: list[McpScope] = []
        for scope in value:
            if scope not in seen:
                seen.add(scope)
                result.append(scope)
        if "project:read" not in result:
            raise ValueError("MCP tokens must include project:read.")
        return result


class McpTokenIssueRequest(McpTokenGrantRequest):
    expires_at: datetime | None = None

    @field_validator("expires_at")
    @classmethod
    def expires_at_must_be_future(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        comparable = value.astimezone(UTC) if value.tzinfo is not None else value.replace(tzinfo=UTC)
        if comparable <= datetime.now(UTC):
            raise ValueError("MCP token expiration must be in the future.")
        return comparable


class McpDeviceAuthorizationRequest(McpTokenGrantRequest):
    pass


class McpDeviceAuthorizationStart(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_code: str
    user_code: str
    verification_url: str
    interval: int
    expires_in: int


class McpDeviceAuthorizationPublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_code: str
    label: str
    scopes: list[McpScope]
    status: McpDeviceAuthorizationStatus
    expires_at: datetime


class McpDeviceAuthorizationDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["approve", "deny"]


class McpDeviceAuthorizationPollRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_code: str = Field(min_length=1, max_length=256)


class McpTokenPublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    project_id: UUID | None
    label: str
    token_prefix: str
    scopes: list[McpScope]
    created_at: datetime
    last_used_at: datetime | None
    expires_at: datetime | None
    revoked_at: datetime | None


class McpDeviceAuthorizationPendingPoll(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["authorization_pending"]
    interval: int


class McpDeviceAuthorizationSlowDownPoll(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["slow_down"]
    interval: int


class McpDeviceAuthorizationDeniedPoll(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["denied"]


class McpDeviceAuthorizationExpiredPoll(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["expired"]


class McpDeviceAuthorizationApprovedPoll(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["approved"]
    token: str
    token_record: McpTokenPublic


McpDeviceAuthorizationPollResponse: TypeAlias = Annotated[
    McpDeviceAuthorizationPendingPoll
    | McpDeviceAuthorizationSlowDownPoll
    | McpDeviceAuthorizationDeniedPoll
    | McpDeviceAuthorizationExpiredPoll
    | McpDeviceAuthorizationApprovedPoll,
    Field(discriminator="status"),
]


class McpTokenIssueResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str
    token_record: McpTokenPublic


class McpTokenListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tokens: list[McpTokenPublic]


class McpTokenRecord(McpTokenPublic):
    issued_by_user_id: UUID


class McpProjectEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project: ProjectSummary
    active_version: ProjectVersionPublic | None
    versions: list[ProjectVersionPublic]


class McpProjectListEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    projects: list[ProjectSummary]


class McpVersionListEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    versions: list[ProjectVersionPublic]


class McpStatusItemListEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[StatusItemPublic]


class McpDocumentEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: Literal["version", "draft"]
    version_body_etag: str
    draft_etag: str | None
    body: dict[str, object]


class McpTableEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: Literal["version", "draft"]
    version_body_etag: str
    draft_etag: str | None
    table_name: str
    # Plan-13 §4.1 / plan-14 P1.3: custom-field-capable tables (e.g.
    # Rooms) ship the `{custom_fields, rows}` envelope under this key;
    # tables without custom fields still emit a bare row list.
    rows: object


class McpStructuredError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str
    request_id: str
    recoverability: McpRecoverability
    details: dict[str, object] = Field(default_factory=dict)
