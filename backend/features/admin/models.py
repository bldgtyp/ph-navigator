"""Domain DTOs for the admin user-management service layer.

Request models for the HTTP routes are added with the routes in Phase 04; these
are the *outputs* the service returns (and the route layer serializes).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from features.auth.account_tokens import AccountTokenType

# Derived account state shown in the dashboard.
#   active   — can sign in (has a usable password, not soft-deleted)
#   invited  — created but no usable password yet (pending invite)
#   inactive — soft-deleted; sessions/tokens revoked
AdminUserStatus = Literal["active", "invited", "inactive"]

# MVP role preset over the capability substrate.
AdminUserRolePreset = Literal["user", "admin"]


class AdminUserRow(BaseModel):
    """One row of the admin user list / the result of a lifecycle mutation."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    email: EmailStr
    display_name: str
    status: AdminUserStatus
    role: AdminUserRolePreset
    is_staff: bool
    created_at: datetime
    last_action_at: datetime | None


class IssuedAccountLink(BaseModel):
    """A one-time invite/reset link, returned only in the create response."""

    model_config = ConfigDict(extra="forbid")

    token_type: AccountTokenType
    link: str


class AdminAuditEntry(BaseModel):
    """A scrubbed audit row for the per-user history view (no secrets)."""

    model_config = ConfigDict(extra="forbid")

    id: int
    action: str
    actor_user_id: UUID | None
    actor_email: str | None
    target_email: str | None
    ip_address: str | None
    created_at: datetime
    details: dict[str, Any]


# --- Request bodies --------------------------------------------------------


class InviteUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    display_name: str = Field(min_length=1, max_length=200)
    role: AdminUserRolePreset = "user"


class SetAdminRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    make_admin: bool


class UpdateUserNameRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=200)


class UpdateUserEmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


# --- Response envelopes carrying a one-time link ---------------------------


class InviteUserResponse(BaseModel):
    """Invite result. The raw link appears here only — never in list/detail."""

    model_config = ConfigDict(extra="forbid")

    user: AdminUserRow
    link: IssuedAccountLink


class ReactivateUserResponse(BaseModel):
    """Reactivate result, including the fresh one-time link."""

    model_config = ConfigDict(extra="forbid")

    user: AdminUserRow
    link: IssuedAccountLink
