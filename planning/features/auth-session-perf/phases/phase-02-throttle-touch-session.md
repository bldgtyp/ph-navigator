---
DATE: 2026-06-04
TIME: 11:40 ET
STATUS: PENDING — depends on Phase 1 being merged.
AUTHOR: Claude (Opus 4.7)
SCOPE: Only call `touch_session` when `now - last_seen_at >=
       session_touch_throttle_seconds`. Default threshold 60 s,
       configurable via a new `Settings` field. The cookie returned
       in the response continues to slide smoothly; the DB row's
       `expires_at` may trail by up to the threshold.
RELATED:
  - ../PRD.md §P3 Phase 2
  - planning/code-reviews/2026-06-04/auth-current-user-pipeline-review.md §3 (b)
  - backend/features/auth/service.py
  - backend/features/auth/repository.py
  - backend/config.py
  - backend/tests/test_auth.py
---

# Phase 2 — Throttle `touch_session`

## P0. Goal

`touch_session` is the only write on the authenticated read path.
After this phase, it fires on roughly one in every
`session_touch_throttle_seconds` requests for an active user instead
of one per request. The cookie's `expires_at` still slides on every
response so the user-visible sliding-expiry behavior is preserved.

## P1. Prerequisite

Phase 1 must be merged. This phase reads `session_last_seen_at` from
the joined `SELECT` Phase 1 added. Do not start before Phase 1 lands
on `main`.

## P2. Files touched

- `backend/config.py` — add `session_touch_throttle_seconds: int =
  60` to the `Settings` class.
- `backend/features/auth/service.py` — guard the `touch_session`
  call with the throttle check.
- `backend/tests/test_auth.py` — add throttle tests.

No migrations. No SQL changes. No repository changes.

## P3. Implementation steps

### Step 1 — Add the setting

In `backend/config.py`, add a single field near the existing
`session_lifetime_minutes` entry:

```python
session_touch_throttle_seconds: int = 60
```

Add a one-line comment if (and only if) the setting's intent is not
obvious from the name. Acceptable terse comment: `# 0 disables
throttling; UPDATE on every authenticated request.`

A value of `0` should mean "disable the throttle and write on every
request" — this is useful for tests that want to verify the old
behavior still works as a fallback.

### Step 2 — Guard the `touch_session` call

In `backend/features/auth/service.py::current_user_from_request`, the
success branch from Phase 1 currently looks like:

```python
expires_at = session_expires_at(now)
repository.touch_session(conn, session_id, expires_at)
user = public_user({...})
result = (user, expires_at)
```

After this phase:

```python
expires_at = session_expires_at(now)
last_seen_at = row["session_last_seen_at"]
throttle = settings.session_touch_throttle_seconds
should_touch = throttle <= 0 or (now - last_seen_at).total_seconds() >= throttle
if should_touch:
    repository.touch_session(conn, session_id, expires_at)
user = public_user({...})
result = (user, expires_at)
```

Key points:

- `expires_at` returned to the caller (and thus written to the
  cookie by `set_session_cookie` if the route calls it) is **always**
  the freshly-computed sliding value, never the stale DB value.
- The DB `expires_at` only advances when `touch_session` fires —
  hence it can trail by up to `session_touch_throttle_seconds`.
- `last_seen_at` from the row is the previous DB-stored value (not
  `now`), so the gate measures real elapsed wall-clock since the
  last write.
- `(now - last_seen_at).total_seconds()` requires both sides to be
  timezone-aware. `now_utc()` returns aware; the schema stores
  `TIMESTAMP WITH TIME ZONE`. Verify the row returns an aware
  datetime — psycopg's default is to do so for `timestamptz`, but
  a quick assertion at the top of the function during development
  is fine to confirm.

### Step 3 — Tests

Add the following tests to `backend/tests/test_auth.py`:

#### Test A — throttle skips the write within the window

1. `create_or_update_user(...)`.
2. Log in with TestClient A.
3. Set `session_touch_throttle_seconds = 60` (default).
4. Read the DB row for the new session, capture
   `original_last_seen_at`.
5. Hit `/api/v1/auth/session` from A.
6. Re-read the DB row; assert `last_seen_at == original_last_seen_at`
   (no write happened because the row was just created).
7. Manually backdate the DB row's `last_seen_at` to `now() -
   interval '90 seconds'` via `transaction()`.
8. Hit `/api/v1/auth/session` again.
9. Re-read; assert `last_seen_at > original_last_seen_at` (the
   throttle window elapsed; the write fired).

#### Test B — cookie `expires_at` slides on every response

1. Log in.
2. Capture `expires_at` from the login JSON.
3. Hit `/api/v1/auth/session` immediately. Capture its
   `expires_at`.
4. Assert the second `expires_at` is `>= ` the first (it should be
   `>` by the wall-clock interval between calls, which can be 0 ms
   on a fast machine; allow equality).
5. Optionally: monkeypatch `now_utc` to advance time by 5 seconds
   between the two calls and assert strict `>`.

#### Test C — throttle=0 disables (writes every request)

1. Monkeypatch `settings.session_touch_throttle_seconds = 0`.
2. Log in.
3. Hit `/api/v1/auth/session` twice in quick succession.
4. Re-read the DB row; assert `last_seen_at` advanced between the
   two requests.

#### Test D — existing expired-session test still passes unchanged

`test_expired_session_is_invalidated` already covers the case where
the row's `expires_at` is in the past. With the throttle, the
behavior is unchanged because expiry is checked *before* the throttle
gate. No new test needed; just confirm the existing one passes.

### Step 4 — Document the cookie/DB drift

In `backend/config.py`, immediately under the new
`session_touch_throttle_seconds` field, add a short comment block
(2–4 lines max) that captures:

- The cookie's `expires_at` is recomputed on every authenticated
  response.
- The DB row's `expires_at` only advances when this throttle fires.
- The gap between cookie and DB `expires_at` is bounded by
  `session_touch_throttle_seconds`.

This is the rare WHY that future-readers will not derive from the
code, so it belongs in a comment per
`context/CODING_STANDARDS.md`.

## P4. Acceptance criteria

- The new `Settings` field exists with default `60`.
- `touch_session` is **not** called when the gate is closed; is
  called when the gate is open or when `throttle <= 0`.
- Test A, B, C above all pass; existing `test_auth.py` tests all
  pass unchanged.
- `make ci` is green from the repo root.

## P5. Verification commands

```bash
cd backend && uv run pytest tests/test_auth.py -v
make format
make ci
```

After merge, run a quick statement-count check:

1. Set `log_sql = True` in `backend/.env`.
2. Restart backend.
3. Make ~20 back-to-back requests to `/api/v1/auth/session` from one
   TestClient or from the browser.
4. Inspect structlog output. Expect: **one `SELECT` per request, and
   one `UPDATE` somewhere within the burst** (rather than 20 SELECTs
   + 20 UPDATEs).

## P6. Risk

- **Cookie/DB drift confuses operators.** If a sysadmin queries
  `sessions.expires_at` directly to ask "is this session live?",
  they will see a value up to 60 s behind the cookie. This is
  documented in the new comment block (step 4) and in
  `../STATUS.md` cross-cutting notes.
- **Throttle masking a bug.** If `touch_session` ever silently fails
  (e.g., row missing), the throttle makes the failure window longer
  before symptoms appear. `touch_session` is a plain UPDATE with no
  return value today, so this risk is unchanged from baseline; flag
  in the PR description.
- **Time-zone naivety.** If a non-tz-aware datetime is ever stored
  in `last_seen_at`, the subtraction at the gate would raise. The
  schema enforces `TIMESTAMP WITH TIME ZONE`, so this is a regression
  guard rather than a real risk.

## P7. Effort

~1 hour. One field added in `config.py`, ~5 lines added in the
service success branch, three new tests.

## P8. Hand-off notes

- Branch suggestion: `auth-perf/phase-02-throttle-touch`.
- After merge, update `../STATUS.md`:
  - Move Phase 2 to **Merged to main** with PR link.
  - Add a measurement row: per-minute `touch_session` write count
    on a representative session (expect ~1, was ~60 with one
    request per second).
  - Decide whether to leave Phase 3 deferred or reopen — record the
    decision and the evidence backing it.
