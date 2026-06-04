---
DATE: 2026-06-04
TIME: 11:35 ET
STATUS: PENDING — implementation has not started.
AUTHOR: Claude (Opus 4.7)
SCOPE: Rewrite the steady-state success branch of
       `current_user_from_request` so it performs **one** `SELECT`
       (no `FOR UPDATE`) that joins `sessions` and `users` on
       `s.user_id = u.id`. The login (`authenticate`) and sign-out
       (`sign_out`) paths keep their existing `FOR UPDATE` usage.
       The partial unique index, the single-active-session
       invariant, and every existing 401 `error_code` are preserved.
RELATED:
  - ../PRD.md §P3 Phase 1
  - planning/code-reviews/2026-06-04/auth-current-user-pipeline-review.md §2 (a), §4 (c)
  - backend/features/auth/service.py
  - backend/features/auth/repository.py
  - backend/alembic/versions/20260512_0002_auth_sessions.py (partial unique index — DO NOT TOUCH)
  - backend/tests/test_auth.py
---

# Phase 1 — Drop read-path `FOR UPDATE` + collapse SELECTs into one JOIN

## P0. Goal

`current_user_from_request` should execute **one** `SELECT` against
the database on the steady-state success path, with no row lock, and
should still write to `sessions` via `touch_session` exactly as it
does today. The write throttle is Phase 2 — do not introduce it
here.

## P1. Files touched

- `backend/features/auth/repository.py` — add one new function;
  do not modify the existing ones.
- `backend/features/auth/service.py` — rewrite the success branch of
  `current_user_from_request` only. Failure branches keep their
  existing 401 paths.
- `backend/tests/test_auth.py` — add one new test for the
  cross-connection supersession race; do not modify existing tests.

No migrations. No schema changes. No `Settings` changes.

## P2. Implementation steps

### Step 1 — Add `get_session_with_user` to the repository

In `backend/features/auth/repository.py`, add a new function:

```python
def get_session_with_user(conn: Connection[Any], session_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT
            s.id                  AS session_id,
            s.user_id             AS session_user_id,
            s.expires_at          AS session_expires_at,
            s.last_seen_at        AS session_last_seen_at,
            s.invalidated_at      AS session_invalidated_at,
            s.invalidation_reason AS session_invalidation_reason,
            u.id                  AS user_id,
            u.email               AS user_email,
            u.display_name        AS user_display_name,
            u.is_active           AS user_is_active,
            u.units_preference    AS user_units_preference
        FROM sessions AS s
        JOIN users AS u ON u.id = s.user_id
        WHERE s.id = %(session_id)s
        """,
        {"session_id": session_id},
    ).fetchone()
```

Notes:

- Inner `JOIN`. The FK is `NOT NULL` with `ON DELETE CASCADE`
  (`alembic/versions/20260512_0002_auth_sessions.py:50`), so a
  session without a user cannot exist. Zero rows ⇒ invalid cookie.
- Every column is aliased, including the two `id` columns, because
  `dict_row` would otherwise collide on the key `id`. Keep the
  aliases distinct and prefixed (`session_*` / `user_*`) so the
  service code reads obviously.
- `last_seen_at` is included even though Phase 1 does not branch on
  it. Phase 2 will. Including it now avoids a second SQL edit in
  Phase 2.
- Do **not** delete or modify `get_session_for_update`. Login and
  sign-out still use it. The two functions intentionally exist
  side-by-side.

### Step 2 — Rewrite `current_user_from_request`

In `backend/features/auth/service.py`, replace the body of
`current_user_from_request` (currently lines 169–218). The new body:

- Parses the cookie + UUID exactly as today (lines 170–177 unchanged).
- Computes `now = now_utc()` exactly as today.
- Opens a `transaction()` exactly as today — we still need it for
  the conditional `touch_session` / `invalidate_session` writes.
- Calls the new `repository.get_session_with_user(conn, session_id)`
  instead of `get_session_for_update`.
- If the returned row is `None` → 401 `invalid_session` (matches
  today's "session is None" case AND today's "user is None" case;
  both reduce to "this cookie does not point at a live row" when the
  JOIN is inner).
- Reads `row["session_invalidated_at"]` →
  `row["session_expires_at"]` → `row["user_is_active"]` →
  success, in that precedence. All `error_code` strings stay
  identical (`session_invalidated`, `session_expired`,
  `invalid_session` for the inactive user, `not_authenticated` for
  the missing-cookie case at the very top).
- On success: pass the user-slice of the row to `public_user(...)`
  via a small local dict, call `touch_session` (unchanged), bind the
  `user_id` contextvar, return `(UserPublic, expires_at)`.

A reference shape for the success branch (illustrative — the
implementer should reconcile against the existing failure branches):

```python
with transaction() as conn:
    row = repository.get_session_with_user(conn, session_id)
    if row is None:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_session", "Sign-in required.")

    if row["session_invalidated_at"] is not None:
        reason = str(row["session_invalidation_reason"] or "invalidated")
        raise api_error(
            status.HTTP_401_UNAUTHORIZED,
            "session_invalidated",
            "Your session is no longer active.",
            {"reason": reason},
        )

    if row["session_expires_at"] <= now:
        repository.invalidate_session(conn, session_id, reason="expired", invalidated_at=now)
        session_expired = True
    else:
        if not row["user_is_active"]:
            raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_session", "Sign-in required.")

        expires_at = session_expires_at(now)
        repository.touch_session(conn, session_id, expires_at)
        user = public_user({
            "id": row["user_id"],
            "email": row["user_email"],
            "display_name": row["user_display_name"],
            "units_preference": row["user_units_preference"],
        })
        result = (user, expires_at)
```

Keep the post-`with` handling of `session_expired` and `result is
None` identical to the current code. Keep
`structlog.contextvars.bind_contextvars(user_id=...)` on success.

### Step 3 — Verify nothing else calls the read function

Grep:

```bash
grep -rn "get_session_for_update\|get_session_with_user" backend --include="*.py" | grep -v ".venv"
```

Expected call sites after the change:

- `service.py::current_user_from_request` → `get_session_with_user`
- `service.py::sign_out` → `get_session_for_update` (unchanged)
- `repository.py` definitions

No other consumers should exist.

### Step 4 — Add the cross-connection supersession test

Add a test to `backend/tests/test_auth.py` (do not modify existing
tests). It must:

1. `create_or_update_user(...)` for an email.
2. Log in with TestClient A → capture the cookie.
3. Log in with TestClient B (same email) → success; this
   supersedes A.
4. Hit `/api/v1/auth/session` from A.
5. Assert the response is 401 with `error_code ==
   "session_invalidated"` and `details["reason"] ==
   "superseded_by_new_login"`.

This is the contract the dropped `FOR UPDATE` is "freeing up". Lock
it in. The existing
`test_single_active_session_invalidates_previous_session` covers a
similar shape but interleaves the calls differently; the new test
should be explicit about "B logs in, *then* A makes a request" so
the precedence is visible in the test name and assertions.

Suggested test name:
`test_stale_cookie_after_supersession_is_session_invalidated`.

## P3. Acceptance criteria

- `current_user_from_request` issues exactly one `SELECT` against
  the database per authenticated request on the steady-state success
  path. Confirm by tailing Postgres logs with
  `log_statement = 'all'` (or set `settings.log_sql = True` and
  inspect structlog output) for a fresh request after the change.
- `current_user_from_request` issues zero `SELECT … FOR UPDATE`
  statements.
- `authenticate` and `sign_out` continue to use
  `get_session_for_update` and `get_user_by_email_for_update` where
  they do today (no changes to those functions, no changes to those
  call sites).
- The full `backend/tests/test_auth.py` suite passes unchanged,
  plus the new supersession test passes.
- `make ci` from the repo root is green.
- The partial unique index `uq_sessions_one_active_per_user` is not
  touched. No new migration is added.

## P4. Verification commands

```bash
# Targeted auth suite
cd backend && uv run pytest tests/test_auth.py -v

# Statement count sanity check — set log_sql=True in backend/.env,
# bounce the server, hit /api/v1/auth/session, and inspect the
# structlog output for the request.
cd backend && uv run uvicorn main:app --reload --log-level info

# Full gate
make format
make ci
```

## P5. Risk

- **Session-security regression.** This is the entire reason the
  audit exists. Mitigated by (a) keeping every failure-path
  `error_code` byte-identical, (b) leaving the partial unique index
  alone, (c) leaving login's user-row `FOR UPDATE` alone, (d) adding
  the new supersession test.
- **`dict_row` column collision.** If any of the aliases drift,
  `dict_row` silently keeps the last column and the service reads
  wrong values. Mitigation: explicit aliases on every column,
  reviewed by eye.
- **Inactive-user code path.** Today `get_user_by_id` could return
  `None` for reasons other than "user inactive" (e.g., hard-deleted
  user). With an inner `JOIN`, that case reduces to "row is `None`",
  which the new code maps to 401 `invalid_session` — same outcome
  as today's `user is None` branch on `service.py:202`. Acceptable;
  flag in the PR description for the reviewer.

## P6. Effort

~1–2 hours including the new test and the structlog statement-count
verification. One repository function added, one service function
rewritten, one test added.

## P7. Hand-off notes

- Phase 2 (throttle `touch_session`) is independent but assumes
  this phase has landed because it reads `session_last_seen_at`
  from the joined row. Do **not** start Phase 2 before this is
  merged.
- Branch suggestion: `auth-perf/phase-01-collapse-reads`.
- After merge, update `../STATUS.md`:
  - Move Phase 1 to **Merged to main** with PR link.
  - Add a row to the measurement table: per-request statement count
    on the success path (expect 2 — joined SELECT + touch UPDATE).
  - Note any surprises (e.g., did the inactive-user code path
    actually reachable in production data — usually a dead branch).
