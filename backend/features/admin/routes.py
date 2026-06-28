"""Admin user-management HTTP routes.

Every route is deny-by-default: the `require_admin` dependency resolves the
session cookie (401 for anonymous) and then requires the `admin.users.manage`
capability (403 for a signed-in non-admin). The frontend nav guard is only
convenience; this gate is authoritative. One-time invite/reset links are
returned only from the create/reset responses, never from list or audit reads.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from features.access.capabilities import ADMIN_USERS_MANAGE
from features.access.user_capabilities import require_user_capability
from features.admin import service
from features.admin.models import (
    AdminAuditEntry,
    AdminUserRow,
    InviteUserRequest,
    InviteUserResponse,
    IssuedAccountLink,
    ReactivateUserResponse,
    SetAdminRequest,
)
from features.auth.models import UserPublic
from features.auth.service import current_user_from_request, user_agent
from features.shared.http import client_ip

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def require_admin(request: Request) -> UserPublic:
    """Resolve the signed-in user and require the admin user-management capability."""
    user, _expires = current_user_from_request(request)
    require_user_capability(user, ADMIN_USERS_MANAGE)
    return user


AdminUser = Annotated[UserPublic, Depends(require_admin)]


@router.get("/users", response_model=list[AdminUserRow])
def list_users(admin: AdminUser) -> list[AdminUserRow]:
    return service.list_users()


@router.post("/users/invite", response_model=InviteUserResponse, status_code=201)
def invite_user(payload: InviteUserRequest, request: Request, admin: AdminUser) -> InviteUserResponse:
    row, link = service.invite_user(
        admin,
        email=str(payload.email),
        display_name=payload.display_name,
        make_admin=payload.role == "admin",
        ip_address=client_ip(request),
        user_agent=user_agent(request),
    )
    return InviteUserResponse(user=row, link=link)


@router.post("/users/{user_id}/reset-link", response_model=IssuedAccountLink, status_code=201)
def generate_reset_link(user_id: UUID, request: Request, admin: AdminUser) -> IssuedAccountLink:
    return service.generate_reset_link(
        admin, target_user_id=user_id, ip_address=client_ip(request), user_agent=user_agent(request)
    )


@router.post("/users/{user_id}/deactivate", response_model=AdminUserRow)
def deactivate_user(user_id: UUID, request: Request, admin: AdminUser) -> AdminUserRow:
    return service.deactivate_user(
        admin, target_user_id=user_id, ip_address=client_ip(request), user_agent=user_agent(request)
    )


@router.post("/users/{user_id}/reactivate", response_model=ReactivateUserResponse)
def reactivate_user(user_id: UUID, request: Request, admin: AdminUser) -> ReactivateUserResponse:
    row, link = service.reactivate_user(
        admin, target_user_id=user_id, ip_address=client_ip(request), user_agent=user_agent(request)
    )
    return ReactivateUserResponse(user=row, link=link)


@router.patch("/users/{user_id}/admin", response_model=AdminUserRow)
def set_admin(user_id: UUID, payload: SetAdminRequest, request: Request, admin: AdminUser) -> AdminUserRow:
    return service.set_admin(
        admin,
        target_user_id=user_id,
        make_admin=payload.make_admin,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
    )


@router.get("/users/{user_id}/audit", response_model=list[AdminAuditEntry])
def list_user_audit(user_id: UUID, admin: AdminUser) -> list[AdminAuditEntry]:
    return service.list_user_audit(user_id)
