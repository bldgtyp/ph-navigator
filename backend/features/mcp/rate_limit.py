"""Per-IP request budgets for the unauthenticated agent device flow."""

from __future__ import annotations

import threading
from time import monotonic

from fastapi import Request
from starlette import status

from config import settings
from features.shared.errors import api_error
from features.shared.http import client_ip

_WINDOW_SECONDS = 60.0


class _FixedWindowLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._windows: dict[str, tuple[float, int]] = {}

    def hit(self, key: str, limit: int, now: float) -> bool:
        with self._lock:
            window_start, count = self._windows.get(key, (now, 0))
            if now - window_start >= _WINDOW_SECONDS:
                window_start, count = now, 0
            count += 1
            self._windows[key] = (window_start, count)
            return count <= limit

    def reset(self) -> None:
        with self._lock:
            self._windows.clear()


_start_limiter = _FixedWindowLimiter()
_poll_limiter = _FixedWindowLimiter()


def reset_device_rate_limiters() -> None:
    """Clear in-process counters for focused boundary tests."""
    _start_limiter.reset()
    _poll_limiter.reset()


def enforce_device_start_budget(request: Request) -> None:
    _enforce(
        _start_limiter,
        request,
        settings.agent_device_start_per_ip_per_minute,
        "Too many agent login requests. Wait and try again.",
    )


def enforce_device_poll_budget(request: Request) -> None:
    _enforce(
        _poll_limiter,
        request,
        settings.agent_device_poll_per_ip_per_minute,
        "Too many agent login polls. Slow down and try again.",
    )


def _enforce(
    limiter: _FixedWindowLimiter,
    request: Request,
    limit: int,
    message: str,
) -> None:
    if not settings.agent_device_rate_limit_enabled:
        return
    key = client_ip(request) or "unknown"
    if not limiter.hit(key, limit, monotonic()):
        raise api_error(status.HTTP_429_TOO_MANY_REQUESTS, "rate_limited", message)
