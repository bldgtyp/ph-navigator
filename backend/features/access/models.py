"""Pydantic DTOs for the access capability model."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, get_args
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

# A grant applies either everywhere (``global``), to every project a team owns
# (``team``), or to a single project (``project``). ``global`` grants carry no
# ``scope_id``; the other two scope to a team or project id respectively.
GrantScopeType = Literal["global", "team", "project"]

GRANT_SCOPE_TYPES: tuple[GrantScopeType, ...] = get_args(GrantScopeType)


class UserGrant(BaseModel):
    """An active or revoked per-user capability grant (``user_grants`` row)."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    user_id: UUID
    capability: str
    scope_type: GrantScopeType
    scope_id: UUID | None
    granted_by: UUID | None
    granted_at: datetime
    revoked_at: datetime | None

    @model_validator(mode="after")
    def _check_scope(self) -> UserGrant:
        # Mirror the DB CHECK constraint so an out-of-band/legacy row that
        # violates the invariant surfaces as a validation error rather than
        # silently flowing through the resolver.
        if (self.scope_type == "global") != (self.scope_id is None):
            raise ValueError("global grants must have no scope_id; team/project grants require one")
        return self
