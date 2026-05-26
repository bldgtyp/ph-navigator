"""Wire contracts for the `/api/v1/health` and `/api/v1/version` endpoints."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

__all__ = ["HealthResponse", "VersionResponse"]


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    service: str
    phase: str
    api_version: str


class VersionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    service: str
    app_version: str
    api_version: str
    environment: str
    git_sha: str | None
