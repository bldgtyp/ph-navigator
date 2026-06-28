"""Editor auth/session API routes."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from features.access.user_capabilities import global_capabilities_for_user
from features.auth.account_completion import complete_invite, complete_reset
from features.auth.models import (
    AccountCompletionRequest,
    AuthSessionResponse,
    LoginRequest,
    UserPreferencesUpdateRequest,
    UserPublic,
)
from features.auth.service import (
    authenticate,
    clear_session_cookie,
    current_user_from_request,
    set_session_cookie,
    sign_out,
    update_units_preference,
    user_agent,
)
from features.shared.http import client_ip

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def require_current_user(request: Request) -> tuple[UserPublic, datetime]:
    return current_user_from_request(request)


def _session_response(user: UserPublic, expires_at: datetime) -> AuthSessionResponse:
    """Build the session response with the user's resolved global capabilities."""
    return AuthSessionResponse(
        user=user,
        expires_at=expires_at,
        capabilities=sorted(global_capabilities_for_user(user)),
    )


# Canonical `CurrentUser` dependency alias. Every feature router that
# needs the authenticated user imports this rather than redeclaring the
# `Annotated[..., Depends(require_current_user)]` shape locally.
CurrentUser = Annotated[tuple[UserPublic, datetime], Depends(require_current_user)]


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, request: Request, response: Response) -> AuthSessionResponse:
    user, session_id, expires_at = authenticate(payload.email, payload.password, request)
    set_session_cookie(response, session_id, expires_at)
    return _session_response(user, expires_at)


@router.get("/session", response_model=AuthSessionResponse)
def session(auth: tuple[UserPublic, datetime] = Depends(require_current_user)) -> AuthSessionResponse:
    user, expires_at = auth
    return _session_response(user, expires_at)


@router.patch("/preferences", response_model=AuthSessionResponse)
def update_preferences(
    payload: UserPreferencesUpdateRequest,
    request: Request,
    auth: tuple[UserPublic, datetime] = Depends(require_current_user),
) -> AuthSessionResponse:
    user, expires_at = auth
    updated = update_units_preference(user, expires_at, payload.units_preference, request)
    return _session_response(updated.user, updated.expires_at)


@router.post("/invite/complete", status_code=204)
def complete_invite_route(payload: AccountCompletionRequest, request: Request) -> Response:
    complete_invite(
        raw_token=payload.token,
        password=payload.password,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
    )
    return Response(status_code=204)


@router.post("/reset/complete", status_code=204)
def complete_reset_route(payload: AccountCompletionRequest, request: Request) -> Response:
    complete_reset(
        raw_token=payload.token,
        password=payload.password,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
    )
    return Response(status_code=204)


@router.post("/logout", status_code=204)
def logout(request: Request) -> Response:
    response = Response(status_code=204)
    sign_out(request)
    clear_session_cookie(response)
    return response
