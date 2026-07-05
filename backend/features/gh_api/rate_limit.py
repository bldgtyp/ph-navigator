"""Minimal per-IP rate limiter for the anonymous-readable GH router.

V2 has no global limiter, and the GH routes allow anonymous GETs, so this is
the one place that needs throttling. It is a deliberately tiny in-process
fixed-window counter — correct for the single Render instance PHN runs on. Do
NOT grow this into distributed limiting; if PHN ever scales horizontally,
replace it wholesale with a shared store.
"""

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
    """Count hits per key within a rolling 60s window; reset when it elapses."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # key -> (window_start_monotonic, hit_count)
        self._windows: dict[str, tuple[float, int]] = {}

    def hit(self, key: str, limit: int, now: float) -> bool:
        """Record one hit for ``key``; return True if it stays within ``limit``."""
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


_limiter = _FixedWindowLimiter()


def reset_rate_limiter() -> None:
    """Clear all counters — for tests that assert limit boundaries."""
    _limiter.reset()


def enforce_gh_rate_limit(request: Request) -> None:
    """FastAPI dependency: 429 once a client IP exceeds the per-minute budget."""
    if not settings.gh_api_rate_limit_enabled:
        return
    key = client_ip(request) or "unknown"
    if not _limiter.hit(key, settings.gh_api_rate_limit_per_minute, monotonic()):
        raise api_error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "rate_limited",
            "Too many requests — slow down and retry shortly.",
        )
