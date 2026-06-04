"""In-memory token cache for import preview → commit.

Preview produces a fully-normalized write set plus a token; commit
exchanges the token for the cached write set. This is the
single-process MVP store: a dict guarded by a lock, TTL 10 min, scoped
to the minting user, one-shot (commit consumes the entry).

Multi-worker deploys would need a shared store (Redis); see
`phase-02-backend-import-pipeline.md` for the deferred work.
"""

from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass
from typing import Final

# 10 minutes is comfortable for the user to read the preview, scroll
# warnings, and click commit. Bumping it does not change correctness;
# just memory pressure under abandoned previews.
TOKEN_TTL_SECONDS: Final[float] = 600.0


@dataclass(frozen=True)
class WriteSet:
    """The data commit replays under a token.

    Only rows destined for insert live here. `Skip matches` policy
    means matched rows never reach the write set; the preview report
    surfaces their count separately.
    """

    rows_to_insert: list[dict[str, object]]


@dataclass
class _CacheEntry:
    write_set: WriteSet
    user_id: str
    expires_at: float


_lock = threading.Lock()
_store: dict[str, _CacheEntry] = {}


def mint_token(write_set: WriteSet, *, user_id: str, now: float | None = None) -> str:
    """Cache `write_set` for `user_id`; return a fresh opaque token."""
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
    """Sentinel results for `consume_token`."""

    OK = "ok"
    MISSING = "missing"  # never minted, expired, or already consumed
    WRONG_USER = "wrong_user"  # token exists but belongs to another user


@dataclass(frozen=True)
class ConsumeResult:
    outcome: str
    write_set: WriteSet | None


def consume_token(token: str, *, user_id: str, now: float | None = None) -> ConsumeResult:
    """One-shot lookup. Returns the write set and removes the entry.

    A stale entry is removed and reported MISSING. A wrong-user
    attempt does NOT remove the entry (the legitimate owner may still
    commit).
    """
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
    """Test helper — clears the cache between cases."""
    with _lock:
        _store.clear()
