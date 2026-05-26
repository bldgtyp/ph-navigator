"""Shared HTTP request helpers.

These utilities normalize per-request data extraction so feature code
and middleware agree on what e.g. "the client IP" or "the request id"
means. Adding the helper here avoids inconsistent reads — e.g. one
caller honoring `X-Forwarded-For` and another reading `request.client.host`
directly behind a reverse proxy.
"""

from __future__ import annotations

from fastapi import Request

__all__ = ["client_ip", "get_request_id"]


def client_ip(request: Request) -> str | None:
    """Return the originating client IP, honoring `X-Forwarded-For`.

    Behind a reverse proxy `request.client.host` is the proxy address;
    the canonical client IP comes from the first entry of
    `X-Forwarded-For`. We fall back to `request.client.host` for direct
    connections (local dev, tests, non-proxied deployments).
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        first = forwarded_for.split(",", 1)[0].strip()
        if first:
            return first
    return request.client.host if request.client else None


def get_request_id(request: Request) -> str:
    """Return the per-request id stamped by `request_context_middleware`.

    The middleware always sets `request.state.request_id` early in the
    pipeline; if a caller reaches code that needs it before the
    middleware has run, return an empty string rather than raising.
    """
    return getattr(request.state, "request_id", "") or ""
