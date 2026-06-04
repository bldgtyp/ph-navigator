"""In-memory token cache for glazing-types import preview → commit.

Mirrors `materials/import_export/tokens.py` with a separate `_store`
so the two catalogs cannot return each other's tokens.
"""

from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass
from typing import Final

TOKEN_TTL_SECONDS: Final[float] = 600.0


@dataclass(frozen=True)
class WriteSet:
    rows_to_insert: list[dict[str, object]]


@dataclass
class _CacheEntry:
    write_set: WriteSet
    user_id: str
    expires_at: float


_lock = threading.Lock()
_store: dict[str, _CacheEntry] = {}


def mint_token(write_set: WriteSet, *, user_id: str, now: float | None = None) -> str:
    issued_at = time.monotonic() if now is None else now
    token = secrets.token_urlsafe(24)
    with _lock:
        _store[token] = _CacheEntry(
            write_set=write_set,
            user_id=user_id,
            expires_at=issued_at + TOKEN_TTL_SECONDS,
        )
    return token


class TokenConsumeOutcome:
    OK = "ok"
    MISSING = "missing"
    WRONG_USER = "wrong_user"


@dataclass(frozen=True)
class ConsumeResult:
    outcome: str
    write_set: WriteSet | None


def consume_token(token: str, *, user_id: str, now: float | None = None) -> ConsumeResult:
    current = time.monotonic() if now is None else now
    with _lock:
        entry = _store.get(token)
        if entry is None:
            return ConsumeResult(outcome=TokenConsumeOutcome.MISSING, write_set=None)
        if entry.expires_at <= current:
            _store.pop(token, None)
            return ConsumeResult(outcome=TokenConsumeOutcome.MISSING, write_set=None)
        if entry.user_id != user_id:
            return ConsumeResult(outcome=TokenConsumeOutcome.WRONG_USER, write_set=None)
        _store.pop(token, None)
        return ConsumeResult(outcome=TokenConsumeOutcome.OK, write_set=entry.write_set)


def reset_for_tests() -> None:
    with _lock:
        _store.clear()
