"""Session-cookie response handling for sliding authenticated sessions."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from fastapi import Request, Response

from config import settings

CallNext = Callable[[Request], Awaitable[Response]]
_DIRECTIVE_STATE_KEY = "auth_session_cookie_directive"


@dataclass(frozen=True)
class SessionCookieDirective:
    """Describe the session-cookie mutation to apply after route handling."""

    session_id: UUID | None = None
    expires_at: datetime | None = None


def set_session_cookie(response: Response, session_id: UUID, expires_at: datetime) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=str(session_id),
        expires=expires_at,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )


def queue_session_cookie_refresh(request: Request, session_id: UUID, expires_at: datetime) -> None:
    """Renew the browser cookie after a request validates and slides its session."""
    setattr(
        request.state,
        _DIRECTIVE_STATE_KEY,
        SessionCookieDirective(session_id=session_id, expires_at=expires_at),
    )


def queue_session_cookie_clear(request: Request) -> None:
    """Discard a browser cookie after its server-side session becomes unusable."""
    setattr(request.state, _DIRECTIVE_STATE_KEY, SessionCookieDirective())


async def sliding_session_cookie_middleware(request: Request, call_next: CallNext) -> Response:
    """Apply queued cookie renewal/clearing to the final API response."""
    response = await call_next(request)
    directive = getattr(request.state, _DIRECTIVE_STATE_KEY, None)
    if not isinstance(directive, SessionCookieDirective):
        return response
    if directive.session_id is None or directive.expires_at is None:
        clear_session_cookie(response)
    else:
        set_session_cookie(response, directive.session_id, directive.expires_at)
    return response
