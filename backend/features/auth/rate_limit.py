"""Login attempt budgets for the public auth route."""

from __future__ import annotations

import threading
from collections.abc import Iterator
from contextlib import contextmanager
from time import monotonic

from fastapi import Request
from starlette import status

from config import settings
from features.shared.errors import api_error
from features.shared.http import client_ip

_WINDOW_SECONDS = 60.0


class _FixedWindowLimiter:
    """Count attempts per key within a rolling 60s window."""

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


_attempt_limiter = _FixedWindowLimiter()
_slot_lock = threading.Lock()
_slot_limit = 0
_slots = threading.BoundedSemaphore(1)


def reset_login_rate_limiter() -> None:
    """Clear limiter state for focused boundary tests."""
    _attempt_limiter.reset()


def enforce_login_attempt_budget(email: str, request: Request) -> None:
    """Reject excess login attempts before Argon2 or audit writes run."""
    if not settings.login_rate_limit_enabled:
        return

    now = monotonic()
    ip_address = client_ip(request) or "unknown"
    if not _attempt_limiter.hit(f"ip:{ip_address}", settings.login_rate_limit_per_ip_per_minute, now):
        raise _rate_limited()

    account = email.strip().lower() or "unknown"
    if not _attempt_limiter.hit(
        f"account:{account}",
        settings.login_rate_limit_per_account_per_minute,
        now,
    ):
        raise _rate_limited()


@contextmanager
def reserve_login_verification_slot() -> Iterator[None]:
    """Bound concurrent Argon2 verifications for login requests."""
    if not settings.login_rate_limit_enabled:
        yield
        return

    limit = max(1, settings.login_password_verify_concurrency_limit)
    slots = _slots_for_limit(limit)
    if not slots.acquire(blocking=False):
        raise _rate_limited()
    try:
        yield
    finally:
        slots.release()


def _slots_for_limit(limit: int) -> threading.BoundedSemaphore:
    global _slot_limit, _slots
    with _slot_lock:
        if _slot_limit != limit:
            _slot_limit = limit
            _slots = threading.BoundedSemaphore(limit)
        return _slots


def _rate_limited() -> Exception:
    return api_error(
        status.HTTP_429_TOO_MANY_REQUESTS,
        "rate_limited",
        "Too many sign-in attempts. Wait and try again.",
    )
