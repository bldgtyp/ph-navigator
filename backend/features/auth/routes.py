"""Editor auth/session API routes."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Request, Response

from features.auth.models import AuthSessionResponse, LoginRequest, UserPublic
from features.auth.service import (
    authenticate,
    clear_session_cookie,
    current_user_from_request,
    set_session_cookie,
    sign_out,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def require_current_user(request: Request) -> tuple[UserPublic, datetime]:
    return current_user_from_request(request)


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, request: Request, response: Response) -> AuthSessionResponse:
    user, session_id, expires_at = authenticate(payload.email, payload.password, request)
    set_session_cookie(response, session_id, expires_at)
    return AuthSessionResponse(user=user, expires_at=expires_at)


@router.get("/session", response_model=AuthSessionResponse)
def session(auth: tuple[UserPublic, datetime] = Depends(require_current_user)) -> AuthSessionResponse:
    user, expires_at = auth
    return AuthSessionResponse(user=user, expires_at=expires_at)


@router.post("/logout", status_code=204)
def logout(request: Request) -> Response:
    response = Response(status_code=204)
    sign_out(request)
    clear_session_cookie(response)
    return response
