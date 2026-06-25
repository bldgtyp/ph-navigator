"""Request-id and browser-origin middleware."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from time import perf_counter
from uuid import uuid4

import structlog
from fastapi import Request, Response
from starlette import status

from config import settings
from features.project_document.formula import reset_formula_overlay_cache
from features.project_document.inverse_view import reset_inverse_view_cache
from features.shared.errors import error_response
from features.shared.http import client_ip

CallNext = Callable[[Request], Awaitable[Response]]

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_REQUEST_ID_MAX = 64

log = structlog.get_logger(__name__)


def _accept_request_id(raw: str | None) -> str:
    if not raw:
        return str(uuid4())
    if len(raw) > _REQUEST_ID_MAX or not raw.isprintable():
        return str(uuid4())
    return raw


def _int_or_none(value: str | None) -> int | None:
    if not value or not value.isdecimal():
        return None
    return int(value)


def _should_log_access(path: str) -> bool:
    if settings.log_sample_health:
        return True
    return path not in {"/health", "/api/v1/health", "/api/v1/openapi.json"}


async def request_context_middleware(request: Request, call_next: CallNext) -> Response:
    request_id = _accept_request_id(request.headers.get("X-Request-ID"))
    request.state.request_id = request_id

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        client_ip=client_ip(request),
    )
    reset_formula_overlay_cache()
    reset_inverse_view_cache()

    start = perf_counter()
    status_code: int | None = None
    response: Response | None = None
    try:
        if request.url.path.startswith("/api/") and request.method in MUTATING_METHODS:
            origin = request.headers.get("Origin")
            # Browser-origin protection is intentional for cookie-authenticated
            # REST writes. Non-browser write clients should use dedicated token
            # surfaces such as MCP rather than bypassing this policy.
            if origin not in settings.cors_origins_set:
                log.warning("api.origin_not_allowed", origin=origin)
                response = error_response(
                    request=request,
                    status_code=status.HTTP_403_FORBIDDEN,
                    error_code="origin_not_allowed",
                    message="Mutating browser requests must come from an allowed origin.",
                    details={"origin": origin},
                )
                status_code = response.status_code
                response.headers["X-Request-ID"] = request_id
                return response

        response = await call_next(request)
        status_code = response.status_code
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception:
        status_code = 500
        log.exception("api.unhandled_exception")
        raise
    finally:
        if _should_log_access(request.url.path):
            fields: dict[str, int | float] = {
                "status": status_code or 500,
                "duration_ms": round((perf_counter() - start) * 1000, 2),
            }
            request_bytes = _int_or_none(request.headers.get("content-length"))
            if request_bytes is not None:
                fields["request_bytes"] = request_bytes
            response_bytes = _int_or_none(response.headers.get("content-length")) if response is not None else None
            if response_bytes is not None and (status_code is None or status_code < 500):
                fields["response_bytes"] = response_bytes
            log.info("http.request", **fields)
        structlog.contextvars.clear_contextvars()
