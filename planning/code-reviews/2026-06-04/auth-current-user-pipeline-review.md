---
DATE: 2026-06-04
TIME: 11:00 ET
STATUS: REVIEW — focused audit of `current_user_from_request`
        (`backend/features/auth/service.py:169-218`) and the three
        repository calls it makes
        (`get_session_for_update`, `get_user_by_id`, `touch_session`).
        Goal: reduce the per-request cost of "who is this user?" without
        weakening the session-invalidation guarantees the auth flow is
        designed to provide. This file is hit on every authenticated
        FastAPI request that depends on `CurrentUser` (auth routes,
        `features/projects/access.py`, and every editor route built on
        them). No code changes here; this is a written tradeoff +
        phasing recommendation only.
AUTHOR: Claude (Opus 4.7)
REVIEWED: `backend/features/auth/service.py`
          `backend/features/auth/repository.py`
          `backend/features/auth/routes.py`
          `backend/features/projects/access.py`
          `backend/alembic/versions/20260512_0002_auth_sessions.py`
          `backend/database.py`
          `backend/tests/test_auth.py`
          `backend/config.py`
SCOPE: Read-only audit. No SQL, service, or migration changes.
       Follow-up to finding #5 in
       `planning/code-reviews/2026-06-04/materials-catalog-performance-review.md`,
       which flagged this hot path while profiling the Materials
       Catalog page.
RELATED:
  - backend/features/auth/service.py:169-218 (the function under review)
  - backend/features/auth/repository.py:142-163 (session SELECT/UPDATE)
  - backend/features/auth/repository.py:91-112 (invalidate_active_sessions — the writer that the FOR UPDATE is defending against)
  - backend/alembic/versions/20260512_0002_auth_sessions.py:53-59 (partial unique index `uq_sessions_one_active_per_user`)
  - backend/features/projects/access.py:35-66 (second call site — runs `current_user_from_request` twice on edit-mode routes)
  - backend/tests/test_auth.py:158-211 (single-active-session + parallel-login guarantees that must keep passing)
---

# Auth `current_user_from_request` — Per-Request Cost Audit

## TL;DR

Every authenticated request runs a 3-statement transaction with a row
lock on the session row. The lock is defending against `login`-time
session supersession, but the actual race it prevents is benign because
the writes involved are idempotent and `READ COMMITTED` already makes
the failure mode safe. The two `SELECT`s can be one. The `UPDATE` does
not need to happen on every request. None of (a)–(d) requires a schema
change; (d) does.

| # | Change | Severity (cost today) | Effort | Per-request win | Risk |
|---|---|---|---|---|---|
| 1 | Drop `FOR UPDATE` from `get_session_for_update` (read path only) | Med | Low | Removes a row-lock + transaction round-trip on the hot path | Low — login still locks the user row; idempotent writers below |
| 2 | Throttle `touch_session` to write only when `last_seen_at` is older than ~60 s | Med | Low | Eliminates ~1 write per authenticated request | Low — `expires_at` slides slightly less smoothly but still slides; cookie still refreshed in the response |
| 3 | Collapse the two `SELECT`s (session + user) into one `JOIN` | Low–Med | Low | One DB round-trip instead of two | Low — pure read fold |
| 4 | In-process session cache keyed by `session_id`, TTL ~30 s, with explicit invalidation on login/logout/preference update | Med (later) | Med–High | Most requests skip the DB entirely | Real — staleness across workers; only worth doing after (1)–(3) |

Recommended order: **1 → 2 → 3 → (defer) 4**. Stop after (3) unless
profiling under multi-worker load still shows the auth DB calls as the
bottleneck.

---

## 1. What runs on every authenticated request today

`current_user_from_request` (`service.py:169-218`):

1. Parse + validate the `phn_session` cookie as a UUID.
2. Open a `transaction()` (`database.py:53`) — opens a connection from
   the pool, issues `BEGIN`.
3. `repository.get_session_for_update` (`repository.py:142-151`) →
   `SELECT id, user_id, expires_at, invalidated_at, invalidation_reason
   FROM sessions WHERE id = %s FOR UPDATE`. Acquires a row-level
   `FOR UPDATE` lock for the duration of the transaction.
4. Branch on `invalidated_at` / `expires_at`:
   - If invalidated → 401 (transaction commits with no changes).
   - If expired → call `invalidate_session` (idempotent UPDATE) → 401.
   - Otherwise:
     - `repository.get_user_by_id` (`repository.py:40-48`) — second
       `SELECT` (round-trip 2).
     - `repository.touch_session` (`repository.py:154-163`) — `UPDATE
       sessions SET expires_at = …, last_seen_at = now() WHERE id = …`
       (round-trip 3, holds the same FOR UPDATE row).
5. `COMMIT`.

So on the steady-state success path: **3 statements, 1 transaction, 1
row lock, 1 `UPDATE`**, executed for every API call from an
authenticated browser. `features/projects/access.py:43-66` makes this
worse on `edit`-mode routes because `require_project_access` runs the
function once, then `optional_current_user` runs it again indirectly
on `view`; many edit-mode handlers will end up calling
`current_user_from_request` twice within one request (separate
transactions). Whatever we save here doubles for those routes.

For context: the Materials Catalog page (per the morning review) makes
1 list request which costs ~25 ms backend-side. The auth pipeline is
3–8 ms of that. It does not dominate the page, but it does dominate
every other small request, and the cost scales 1:1 with API calls.

---

## 2. Question (a): Why does `FOR UPDATE` exist, and can it be dropped?

### Where the lock came from

The intent is visible from the surrounding code. The `sessions` table
has a **partial unique index** that enforces "at most one active
session per user":

```
CREATE UNIQUE INDEX uq_sessions_one_active_per_user
  ON sessions (user_id) WHERE invalidated_at IS NULL;
-- alembic/versions/20260512_0002_auth_sessions.py:53-59
```

When a user logs in again (`authenticate`, `service.py:104-161`), the
service:

1. `SELECT … FOR UPDATE` on the **user** row
   (`get_user_by_email_for_update`).
2. `UPDATE sessions SET invalidated_at = …, invalidation_reason =
   'superseded_by_new_login' WHERE user_id = … AND invalidated_at IS
   NULL` (`invalidate_active_sessions`).
3. `INSERT` the new session.

The corresponding read path (`current_user_from_request`) uses
`FOR UPDATE` on the **session** row so that:

- A concurrent login cannot mark the session invalid between the
  service reading `invalidated_at IS NULL` and the service calling
  `touch_session`.
- Two concurrent requests on the same cookie cannot both succeed and
  step on each other while the row is being mutated.

This is a defensible choice — "while I am inspecting and refreshing
this session, no one else may change it" — and the test
`test_parallel_login_attempts_do_not_escape_single_active_session`
(`tests/test_auth.py:191-210`) is the contract we must preserve.

### Why the lock is doing less work than it looks

The actual writers the lock is defending against are all idempotent:

| Writer | What it does on the session row | Conflict with concurrent reader |
|---|---|---|
| `invalidate_active_sessions` (login supersession) | `UPDATE … SET invalidated_at = $now, invalidation_reason = …` | Postgres takes a row-level write lock during the UPDATE itself; the reader's stale view of `invalidated_at = NULL` does not cause data loss. |
| `invalidate_session` (expiry / sign-out) | `UPDATE … SET invalidated_at = COALESCE(…)` | `COALESCE` is explicitly idempotent. |
| `touch_session` (this function itself) | `UPDATE … SET expires_at = …, last_seen_at = now()` | Two concurrent touches race on a write but the values they write are within milliseconds of each other; either is fine. |

In `READ COMMITTED` (Postgres default, used here), dropping
`FOR UPDATE` produces the following sequence under a
concurrent-login race:

1. Request A `SELECT`s the session, sees `invalidated_at = NULL`.
2. Login B `UPDATE`s the session, sets `invalidated_at = now`, COMMITs.
3. Request A `SELECT`s the user (fine — user row is independent).
4. Request A `UPDATE`s the session via `touch_session` — Postgres
   blocks briefly on the row lock B released, then advances
   `expires_at` / `last_seen_at` on a row that is **already
   invalidated**.

End state: row has `invalidated_at = $b_time`, `invalidation_reason =
'superseded_by_new_login'`, and a slightly-advanced `expires_at` /
`last_seen_at`. The **next** request from A's browser hits
`current_user_from_request` → reads `invalidated_at != NULL` → 401
`session_invalidated`. This is exactly what we want. A is logged out.

The only observable difference vs. the `FOR UPDATE` version is that
A's *in-flight request* completes successfully instead of being
rejected mid-flight. That is not a security degradation — A held a
valid cookie at the moment the request arrived; the supersession was
not committed yet. Same as if the login had arrived 50 ms later.

The single-active-session invariant the test cares about
(`tests/test_auth.py:185-188, 208-210`) is enforced by the **partial
unique index**, not by `FOR UPDATE` on the read path. The unique index
is the actual fence; the lock here is belt-on-suspenders.

### What if we keep the lock but only on the write paths?

We can. The cleanest split is:

- Read path (`current_user_from_request`): plain `SELECT` (no
  `FOR UPDATE`).
- Write paths (`authenticate` supersession; `sign_out`; expiry
  invalidation): keep `FOR UPDATE` where they already use it — they
  already do for `users`, and `sign_out` calls
  `get_session_for_update` on `sessions`.

This narrows the lock from "every authenticated GET" to "login,
logout, expiry". For an interactive web app, that is several orders
of magnitude fewer locks.

### Recommendation (a)

Drop `FOR UPDATE` from the **read** code path only. The simplest way
without changing the repository signature is to split
`get_session_for_update` into two functions:

- `get_session_for_update(...)` — unchanged, used by `authenticate`
  and `sign_out`.
- `get_session(...)` — same SQL, no `FOR UPDATE`, used by
  `current_user_from_request`.

Keep the partial unique index. Keep the user-row `FOR UPDATE` in
`authenticate`. Add one test that explicitly exercises "concurrent
login + request on old cookie → next request on old cookie returns
`session_invalidated`" to lock in the contract.

---

## 3. Question (b): Throttle `touch_session`

### Why `touch_session` is the most expensive part

It is the only write on the hot path. Every authenticated request
generates:

- One row UPDATE → WAL record + dirty page.
- Heap bloat over time (UPDATE in MVCC = insert new tuple version,
  mark old dead). The `sessions` table will autovacuum but it is the
  most write-frequented table in the app.
- A buffer-pool dirtying for a row whose only purpose is sliding-window
  expiry.

Login lifetime is `session_lifetime_minutes = 60` (`config.py:34`).
Sliding window precision of "this request was within the last second"
is not useful — the user-visible behavior is "you got logged out
because you were idle for an hour". Granularity of 30–60 s is more
than enough for that UX.

### What to throttle on

`last_seen_at` is the natural marker. Pseudocode at the call site:

```
if session["last_seen_at"] < now - THROTTLE_INTERVAL:
    repository.touch_session(conn, session_id, expires_at)
expires_at_for_cookie = max(session["expires_at"], session_expires_at(now))
```

Requirements that follow:

- The read `SELECT` must return `last_seen_at` (one extra column, free).
- The cookie's `expires_at` returned in the response should still
  reflect the *intended* sliding expiry, even when we skip the DB
  write. Otherwise the cookie expires while the DB row says it's
  still valid. The simplest way: always compute
  `session_expires_at(now)` for the cookie; only write to the DB when
  the threshold is crossed.
- The DB-stored `expires_at` will then trail the cookie's `expires_at`
  by up to `THROTTLE_INTERVAL`. That's fine — `expires_at` in the DB
  is the inactivity timeout floor; the next request that crosses the
  threshold pushes it forward.

### Risk: the DB row expires while the cookie does not

If the user makes a request, then idles for `60 - THROTTLE_INTERVAL`
minutes minus a hair, then comes back: cookie says "valid until
$cookie_exp", DB says `expires_at = $db_exp` which is `THROTTLE_INTERVAL`
older. With `THROTTLE_INTERVAL = 60 s`, the DB clock and the cookie
clock disagree by at most a minute. The DB is the source of truth, so
the cookie can claim "valid" while the server says "expired" by up to
a minute. This is acceptable — users do not perceive a 60-s difference
in idle-logout timing — but it should be a deliberate decision.

### Tuning

Recommended starting value: **60 seconds**, configurable as
`settings.session_touch_throttle_seconds` with default 60. Even with
60 s, a user making 60 requests in 60 s will produce only one UPDATE
instead of 60 — order-of-magnitude reduction for any interactive UI.

### Recommendation (b)

Add throttling. Low risk, large reduction in DB writes, mechanical
change. Pair it with a test that:

1. Logs in.
2. Hits `/api/v1/auth/session` twice within `THROTTLE_INTERVAL`.
3. Asserts the second call did NOT advance `last_seen_at` in the DB
   row (or did NOT increment a `touch_count` test counter).
4. Sleeps past the threshold, hits again, asserts it DID advance.

---

## 4. Question (c): Collapse the two `SELECT`s into one round-trip

### Mechanical

`get_session_for_update` returns the session row;
`get_user_by_id(session["user_id"])` returns the user row. There is no
business logic between them — only the `invalidated_at` / `expires_at`
checks, which are pure local comparisons. A single statement returns
the joined row:

```
SELECT
    s.id              AS session_id,
    s.user_id         AS session_user_id,
    s.expires_at      AS session_expires_at,
    s.last_seen_at    AS session_last_seen_at,
    s.invalidated_at  AS session_invalidated_at,
    s.invalidation_reason,
    u.id              AS user_id,
    u.email,
    u.display_name,
    u.is_active,
    u.units_preference
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.id = %(session_id)s
```

Notes:

- Use `JOIN`, not `LEFT JOIN`. The FK is `NOT NULL` and `ON DELETE
  CASCADE`, so a session without a user cannot exist — if the join
  returns zero rows, the cookie is invalid and the 401 path is
  correct.
- This kills the `user is None` branch in `service.py:201` for
  reasons other than `is_active = false`. Keep the `is_active` check.
- The two columns named `id` would collide in `dict_row`; aliasing
  them as above keeps each accessible. The service code currently
  reads `session["user_id"]`, `session["expires_at"]`,
  `session["invalidated_at"]`, and `user["id"]`, `user["email"]`,
  `user["display_name"]`, `user["is_active"]`, `user["units_preference"]`
  — alias the joined row to match those keys, or update the call site
  to read from the flat row. Match-the-keys is the smaller diff.

### Combined effect with (a) and (b)

After (a) and (c), the steady-state hot path is **one `SELECT`, no
transaction, no row lock**, plus a conditional `UPDATE` from (b).
For a user actively clicking around, the typical path is *one
`SELECT`*. For a user idle past the throttle, *one `SELECT` + one
`UPDATE`*.

### Risk

Minimal — a pure refactor of the read shape. The only thing to
preserve is order of failure checks (invalidated → expired → inactive
user → success) so the existing 401 `error_code` strings don't change.
That contract is already covered by
`test_login_session_and_logout_flow`,
`test_expired_session_is_invalidated`, and
`test_single_active_session_invalidates_previous_session`.

### Recommendation (c)

Do it together with (a) — same function, same change site, and the
new SQL is what the no-lock read path should look like anyway.

---

## 5. Question (d): In-memory session cache

### Shape

Keyed by `session_id` (UUID). Value: `(UserPublic, expires_at,
last_seen_at, invalidated_at, cached_at)`. TTL: 30 s (short enough
that staleness windows are bounded, long enough to absorb a typical
page's request burst). On miss → run the collapsed query from (c),
populate. On hit → serve from cache, skip the DB entirely (subject to
the throttling rule from (b) still firing the periodic `UPDATE`).

### Where this gets dangerous

The auth flow exists to enforce a **security boundary**. The cache
is a per-process structure, so anything that invalidates a session
elsewhere needs to invalidate the cache too:

| Event | Where it happens | Cache invalidation strategy |
|---|---|---|
| Same-process login supersession | `authenticate` in this worker | Direct: drop the old session_id from the local cache. |
| Cross-process login supersession | `authenticate` in a *different* uvicorn worker | Local cache in worker A still serves stale "valid" for up to TTL after worker B invalidates. **This is the failure mode**. |
| Cross-process logout | `sign_out` in another worker | Same as above. |
| Manual invalidation (e.g., admin force-logout) | Direct SQL | No cache eviction. Up to TTL of staleness. |
| Preference update | `update_units_preference` in this worker | Direct: update or evict the cached row. |

The cross-process staleness window is the one that matters. With TTL
= 30 s, a user who clicks "log out everywhere" or whose admin
deactivates them can still execute authenticated requests for up to
30 s. For Phius/PH-Navigator's threat model this is arguably
acceptable, but it should be a deliberate, documented decision, not
an accidental one.

### Why this is deferred

After (a)+(b)+(c) the auth pipeline is one indexed PK lookup per
request, plus an UPDATE every ~60 s. PostgreSQL with a warm cache will
serve the SELECT in <0.5 ms over the loopback interface. Unless the
production environment shows the DB hop as a real cost — which is
unlikely until we are well past dozens of concurrent users per worker
— the security/operational tradeoffs of a stale per-process cache
outweigh the savings.

If we ever do need it, the right shape is probably a **negative
cache** for `invalidated_at != NULL` (cheap to invalidate, hard to
get wrong) rather than a positive cache for valid sessions.

### Recommendation (d)

**Don't build it yet.** Note the design above so we know what we'd do
if needed, and revisit after measuring (a)+(b)+(c) under realistic
multi-worker load.

If we later decide we want it, prerequisites:

1. A Postgres `LISTEN/NOTIFY` channel (`sessions_invalidated`) fired
   from the writer paths to fan invalidation out to all workers.
2. An in-process subscriber per worker that drops cache entries on
   notify.
3. A documented "max staleness" SLO so that downstream code knows
   how stale an auth decision can be.

That is meaningful infrastructure for a milliseconds-per-request win.
Not in this round.

---

## 6. Recommended phased path

### Phase 1 — Drop the read-path lock + collapse the SELECTs

- Repository: split `get_session_for_update` into a no-lock
  `get_session_with_user` (with the JOIN from §4) plus the existing
  `get_session_for_update` (untouched, used by login/logout).
- Service: rewrite the success branch of `current_user_from_request`
  to use the joined row. Failure branches stay the same.
- Tests: add a regression test for "concurrent login on a different
  process invalidates the old cookie; the next request on the old
  cookie gets `session_invalidated`". The existing parallel-login
  test still proves the single-active-session invariant.

Expected win: one DB round-trip + one row lock removed per
authenticated request. Hours of work.

### Phase 2 — Throttle `touch_session`

- Config: add `session_touch_throttle_seconds: int = 60`.
- Service: only call `touch_session` when `last_seen_at < now -
  throttle`. Always compute `expires_at` for the cookie locally.
- Tests: assert the throttle window — within window, no DB write;
  past window, write occurs.

Expected win: ~1 UPDATE per authenticated request → ~1 UPDATE per
60 s per active session. Hours of work.

### Phase 3 — Stop and measure

Re-profile against `/catalog/materials` and a representative editor
page. If auth still shows up in the trace as a real cost, revisit (d).
If not, leave it alone.

### Out of scope for this audit

- Switching to JWT or signed-cookie sessions (different security
  model; removes the "force log out" guarantee entirely; not what
  was asked).
- Moving the lock-check into FastAPI middleware so it runs once per
  request even when multiple dependencies need it. Worth considering
  later as a structural cleanup, but the `access.py` double-call is
  the actual symptom and is independently fixable.
- A `last_active` column with `INSERT ON CONFLICT` for write
  batching — over-engineered relative to (b).

---

## 7. What I'd want a reviewer to push back on

- "Are you sure the partial unique index is enough?" Yes — the index
  is what prevents two `invalidated_at IS NULL` rows for the same
  user. Two concurrent logins racing to insert a new session will
  have exactly one of the two `INSERT`s succeed; the other gets a
  unique-violation. The `FOR UPDATE` on the user row in
  `authenticate` keeps that race orderly. None of this depends on
  `FOR UPDATE` on the read path.
- "What about the case where `touch_session` advances `expires_at`
  on an invalidated row?" Confirmed in §2: end state is invalidated,
  next request rejects. Not a security issue.
- "Is the JOIN safe under the `dict_row` factory when two columns are
  named `id`?" No — psycopg's `dict_row` will overwrite; that's why
  the SQL in §4 aliases both. Same caution applies to any other
  shared column names if columns are ever added.
- "Why not just memoize within a single request?" Already effectively
  done — `CurrentUser` is a FastAPI dependency, so a single route
  resolves it once. The double-call in `access.py` is the exception
  and should be cleaned up regardless; that's structural, not a
  caching concern.
