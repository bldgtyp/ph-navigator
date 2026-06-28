"""Pydantic contracts for editor auth/session routes."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

UnitSystem = Literal["SI", "IP"]


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    email: EmailStr
    display_name: str
    units_preference: UnitSystem


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1)


class AuthSessionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user: UserPublic
    expires_at: datetime
    # The user's resolved global capability keys, so the frontend can hide
    # affordances (e.g. the admin nav) it is not allowed to use. Convenience
    # only — every backend route re-checks authorization.
    capabilities: list[str] = Field(default_factory=list)


class UserPreferencesUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    units_preference: UnitSystem


class AccountCompletionRequest(BaseModel):
    """Invite/reset completion: the raw token (from the link fragment) + new password."""

    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1)
    password: str = Field(min_length=8, max_length=1024)
