"""Pydantic contracts for project lifecycle status items."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

StatusState = Literal["todo", "done", "na"]


class StatusItemPublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    project_id: UUID
    order_index: float
    title: str
    state: StatusState
    completion_date: date | None
    description: str | None
    created_at: datetime
    created_by: UUID | None
    updated_at: datetime
    updated_by: UUID | None


class StatusItemListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[StatusItemPublic]


class StatusItemCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    state: StatusState = "todo"
    completion_date: date | None = None
    description: str | None = Field(default=None, max_length=4000)
    order_index: float | None = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_required_title(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("description", mode="before")
    @classmethod
    def strip_optional_description(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class StatusItemUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    state: StatusState | None = None
    completion_date: date | None = None
    description: str | None = Field(default=None, max_length=4000)
    order_index: float | None = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_required_title(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("description", mode="before")
    @classmethod
    def strip_optional_description(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value
