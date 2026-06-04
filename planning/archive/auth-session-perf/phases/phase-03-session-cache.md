---
DATE: 2026-06-04
TIME: 11:45 ET
STATUS: DEFERRED — design only. Do not build without re-measurement
        evidence per the trigger condition in §P0.
AUTHOR: Claude (Opus 4.7)
SCOPE: In-process session cache keyed by `session_id`, served per
       uvicorn worker, with cross-worker invalidation via Postgres
       `LISTEN/NOTIFY`. Trades a bounded cross-worker staleness
       window for skipping the DB entirely on most authenticated
       requests. Captured here so a future maintainer doesn't have
       to re-derive the design.
RELATED:
  - ../PRD.md §P3 Phase 3
  - planning/code-reviews/2026-06-04/auth-current-user-pipeline-review.md §5 (d)
  - backend/features/auth/service.py
  - backend/features/auth/repository.py
  - backend/database.py (connection pool — relevant if a dedicated LISTEN connection is added)
---

# Phase 3 — In-process session cache (Deferred)

## P0. Trigger condition

**Do not start this phase unless all of the following are true:**

1. Phase 1 and Phase 2 have shipped to `main`.
2. A fresh profiling pass against a realistic multi-worker
   configuration (≥ 2 uvicorn workers, ≥ 50 concurrent authenticated
   users, real catalog data) shows the auth dependency consuming a
   meaningful share (rule of thumb: ≥ 10%) of a typical request's
   server-side time.
3. The DB connection pool is observably under pressure during that
   profiling pass (e.g., `psycopg_pool` wait time > 1 ms p50, or
   pool exhaustion warnings in the logs).

If those conditions are not met, leave this phase deferred. After
Phases 1 + 2, the auth read path is **one indexed PK-joined `SELECT`**
that Postgres serves from shared buffers in < 0.5 ms over the
loopback. The expected gain from caching is small; the staleness and
operational complexity are large.

## P1. Why it's risky

The auth pipeline is a security boundary. Caching means a worker can
serve "this session is valid" to a request after some other actor
has invalidated the session. The actors that can invalidate are:

- Login from a different device (handled in this worker, this
  request) — easy to invalidate locally.
- Login from a different device (handled in a **different** worker)
  — the staleness window matters.
- Sign-out from a different device, in any worker — same as above.
- Admin force-logout via direct SQL — *no* application code runs,
  so any pure-application invalidation strategy misses it.
- Server-side cron that expires very old sessions — same as admin
  case.

The staleness window is the maximum delay between an invalidation
occurring and every worker's cache reflecting it. With a naive TTL,
that window is the TTL. With `LISTEN/NOTIFY`, it is roughly the
notify-fanout latency (sub-millisecond on the same host, single-digit
milliseconds across hosts) — but **only for invalidations the
application code knows about**. The direct-SQL paths still need a
TTL backstop.

For PH-Navigator V2's threat model (small internal user base, no
high-stakes financial transactions, deactivation is mostly a "make
this account stop working" intent rather than a "stop this attacker
right now" intent), a bounded staleness window is probably
acceptable. **But it must be a deliberate, documented decision, not
an accident of the cache implementation.**

## P2. Design sketch (if/when built)

### Shape

```python
# Per uvicorn worker, not shared across processes.
SessionCacheEntry = TypedDict(
    "SessionCacheEntry",
    {
        "user": UserPublic,
        "session_expires_at": datetime,
        "session_last_seen_at": datetime,
        "session_invalidated_at": datetime | None,
        "session_invalidation_reason": str | None,
        "cached_at": datetime,
    },
)

# Key: session_id (UUID).
# Bounded size; LRU eviction at N entries (N = e.g. 10_000 — pick
# based on memory budget and expected concurrent-user count).
# TTL: settings.session_cache_ttl_seconds (default 30).
```

### Read path

1. `current_user_from_request` parses the cookie.
2. Cache lookup by `session_id`.
3. On hit:
   - If `cached_at + TTL < now`, evict and fall through to miss.
   - Else: evaluate `invalidated_at` / `expires_at` / `is_active`
     against the cached row. If they pass, return without touching
     the DB at all. If they fail, fall through to miss (the DB will
     give the authoritative answer).
4. On miss: run the Phase 1 joined `SELECT` exactly as today.
   Populate the cache. Continue the existing flow.
5. The Phase 2 throttle still applies on the write side.

### Invalidation paths (must be implemented; otherwise do not ship)

- **`authenticate` (login).** After `invalidate_active_sessions`
  returns the list of superseded session IDs, evict each from the
  local cache **and** publish a `pg_notify('phn_session_invalidated',
  session_id)` message inside the transaction.
- **`sign_out`.** Same — evict locally, publish.
- **`invalidate_session` (expiry, called from the read path).**
  Same — evict locally, publish.
- **`update_units_preference`.** Update or evict the cached
  `UserPublic` so the next request reflects the new preference.
- **Cross-worker listener.** Each uvicorn worker holds a dedicated
  `LISTEN phn_session_invalidated` connection (separate from the
  request-serving pool — otherwise pool exhaustion blocks
  notifications). A background task drains notifications and evicts
  matching cache entries.

### Settings to add

- `session_cache_enabled: bool = False` — feature flag. Off by
  default; even after this phase ships, opt-in per environment.
- `session_cache_ttl_seconds: int = 30` — backstop staleness for
  invalidations the listener missed.
- `session_cache_max_entries: int = 10_000` — LRU bound.

### Things this design intentionally does **not** include

- A shared cache (Redis, memcached). Crosses a new
  dependency boundary for a small win, and the operational story
  for "is Redis available?" becomes "is auth available?". Not
  worth it at this scale.
- A bloom filter or negative cache. Premature.
- Synchronous cross-worker confirmation before serving from cache.
  That would defeat the latency win.

## P3. Tests (if/when built)

- Hit-then-miss-then-hit lifecycle in one worker.
- TTL expiry causes miss after the configured interval.
- Local invalidation evicts immediately.
- `NOTIFY` from one process is observed and evicts the entry in
  another process. (Subprocess-based test or two-`TestClient`-on-
  separate-pools setup.)
- Disabling the cache via the feature flag reproduces Phase 1 + 2
  behavior exactly.
- Stress test: 1,000 cache lookups during a concurrent supersession
  burst — the worker that did not perform the login must eventually
  reject the stale cookie within the TTL window.

## P4. Operational concerns

- **Memory.** `N * sizeof(entry)`. With `UserPublic` ~200 bytes
  including overhead and N=10k, ~2 MB per worker. Negligible.
- **Connection budget.** One additional Postgres connection per
  worker for `LISTEN`. Factor into pool sizing.
- **Failure mode if the LISTEN connection drops.** Workers must
  reconnect and re-sync. While disconnected, fall back to TTL-only
  behavior. Log loudly.
- **Observability.** Cache hit/miss/eviction counters, exposed via
  the existing metrics surface. Without these, a regression here is
  invisible until users complain.

## P5. Effort estimate (if/when built)

Real work, not Phase 1/2 scale. Ballpark:

- Cache + LRU + invalidation in service code: ~1 day.
- `LISTEN/NOTIFY` plumbing (dedicated connection, background task,
  reconnect handling): ~1 day.
- Tests (in-process + cross-process): ~1 day.
- Observability + load-test verification: ~0.5–1 day.

Roughly a working week. By comparison, Phases 1 + 2 are a half-day
total. That asymmetry is the main reason this phase is deferred.

## P6. Decision to revisit

This phase is **Deferred** until the trigger condition in §P0 is
met. When revisited, update `../STATUS.md` with the measurement
evidence that motivated the change and a date.

If the conclusion is "still not worth it", record that decision too
so future maintainers don't re-explore the same ground.
