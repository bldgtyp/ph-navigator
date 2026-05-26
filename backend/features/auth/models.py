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


class UserPreferencesUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    units_preference: UnitSystem
