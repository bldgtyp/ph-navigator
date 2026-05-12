"""Request-id and browser-origin middleware."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import Request, Response
from starlette import status

from config import settings
from features.shared.errors import error_response

CallNext = Callable[[Request], Awaitable[Response]]

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


async def request_context_middleware(request: Request, call_next: CallNext) -> Response:
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    request.state.request_id = request_id

    if request.url.path.startswith("/api/") and request.method in MUTATING_METHODS:
        origin = request.headers.get("Origin")
        # Browser-origin protection is intentional for cookie-authenticated
        # REST writes. Non-browser write clients should use dedicated token
        # surfaces such as MCP rather than bypassing this policy.
        if origin not in settings.cors_origins_set:
            response = error_response(
                request=request,
                status_code=status.HTTP_403_FORBIDDEN,
                error_code="origin_not_allowed",
                message="Mutating browser requests must come from an allowed origin.",
                details={"origin": origin},
            )
            response.headers["X-Request-ID"] = request_id
            return response

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
