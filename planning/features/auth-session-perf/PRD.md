---
DATE: 2026-06-04
TIME: 11:30 ET
STATUS: PRD — requirements locked. Per-phase implementation plans live
        under `phases/phase-NN-short-title.md`. Implementation has not
        started.
AUTHOR: Claude (Opus 4.7)
SCOPE: Reduce the per-request cost of `current_user_from_request`
       (`backend/features/auth/service.py:169-218`) without weakening
       the session-security guarantees the auth flow provides today.
       In particular: drop the read-path `SELECT … FOR UPDATE`,
       collapse the two per-request `SELECT`s into one, and throttle
       the per-request `touch_session` `UPDATE`. The third option
       discussed in the audit (in-process session cache) is captured
       in this PRD as **Deferred** behind a measurement gate.
NON-GOALS:
  - Switching to JWT or signed-cookie sessions. Different security
    model, removes the "force log out" guarantee. Out of scope.
  - Replacing raw psycopg + repository pattern with an ORM or query
    builder. The repository contract stays as-is.
  - Building a multi-worker session cache with `LISTEN/NOTIFY`. Held
    in Phase 3 as a deferred design; do not build speculatively.
  - Rate-limiting, brute-force lockout, or any other auth policy
    change. Different concern.
  - Touching the login (`authenticate`) write path beyond the
    repository split. Login keeps its current `FOR UPDATE` on the
    user row and its `invalidate_active_sessions` writer; nothing
    about the single-active-session invariant changes.
RELATED:
  - planning/code-reviews/2026-06-04/auth-current-user-pipeline-review.md
  - planning/code-reviews/2026-06-04/materials-catalog-performance-review.md (§5 trigger)
  - context/CODING_STANDARDS.md
  - backend/features/auth/service.py
  - backend/features/auth/repository.py
  - backend/features/auth/routes.py
  - backend/features/projects/access.py (second consumer of `current_user_from_request`)
  - backend/alembic/versions/20260512_0002_auth_sessions.py (partial unique index that enforces the invariant)
  - backend/tests/test_auth.py (contract suite that must stay green)
  - backend/config.py (`session_lifetime_minutes` + new `session_touch_throttle_seconds`)
---

# Auth Session Pipeline Performance — PRD

## P0. Intent

Every authenticated API request currently runs:

1. `BEGIN`
2. `SELECT … FROM sessions WHERE id = … FOR UPDATE`
3. `SELECT … FROM users WHERE id = …`
4. `UPDATE sessions SET expires_at = …, last_seen_at = now() WHERE id = …`
5. `COMMIT`

That is one transaction, one row lock, three statements, and one
write on the hot path. The audit
(`planning/code-reviews/2026-06-04/auth-current-user-pipeline-review.md`)
established that:

- The `FOR UPDATE` on the read path is defending against a race that
  is already safely handled by Postgres' MVCC + the partial unique
  index `uq_sessions_one_active_per_user` + the idempotent writers on
  the session row. Login (`authenticate`) still locks the user row,
  which is the actual fence.
- The two `SELECT`s have no business logic between them and can be a
  single `JOIN`.
- `touch_session` is the only write on the hot path and runs on every
  request. The sliding-expiry UX it provides does not need 1-second
  precision; 30–60 s precision is plenty.

This PRD ships those changes as two independently shippable phases,
with a third phase preserved as a documented-but-deferred design.

## P1. Triggering evidence

See `planning/code-reviews/2026-06-04/auth-current-user-pipeline-review.md`
for the full safety analysis, race-by-race reasoning, the JOIN
shape, the throttle semantics, and the rejected alternatives. This
PRD assumes those findings; it does not re-derive them.

## P2. Scope

In scope:

1. Drop the read-path `FOR UPDATE` and collapse the two `SELECT`s
   into one `JOIN` (Phase 1).
2. Throttle `touch_session` to write only when `last_seen_at` is
   older than a configurable threshold (Phase 2).
3. Document — but **do not build** — an in-process session cache
   with cross-worker invalidation (Phase 3, Deferred).

Out of scope:

- The five "Non-goals" in the front matter.
- The `features/projects/access.py` structural question of whether
  edit-mode routes can resolve the current user only once. Worth
  cleaning up; not blocking this feature; handled separately if at
  all. Phase 1 will note it where relevant but will not change the
  call graph.
- Any change to cookie attributes (`HttpOnly`, `SameSite`, `Secure`),
  cookie name, or session lifetime defaults.
- Any change to `user_action_log` writes. The audit log is not on
  the hot path being optimized.

## P3. Requirements

### Phase 1 — Drop read-path lock + collapse the two SELECTs

- After this phase: `current_user_from_request` performs **one**
  `SELECT` (no `FOR UPDATE`) that joins `sessions` and `users` on
  `s.user_id = u.id`, returning the columns the existing code reads
  from both rows.
- The transaction wrapper around the read path may stay (for the
  conditional `touch_session` write) or move; phase plan decides.
  Either way, the read `SELECT` itself is not inside a `FOR UPDATE`
  scope.
- All five existing 401 `error_code` strings — `not_authenticated`,
  `invalid_session`, `session_invalidated`, `session_expired`, and
  the inactive-user case — continue to be returned in the same
  precedence order (invalidated → expired → inactive user → success)
  for the same inputs.
- The partial unique index `uq_sessions_one_active_per_user` is
  unchanged. The single-active-session invariant is unchanged.
- Login (`authenticate`) keeps its `FOR UPDATE` on the user row and
  its `invalidate_active_sessions` writer.
- `sign_out` keeps its `FOR UPDATE` on the session row (it is the
  writer, not a reader).
- A new repository function is added for the read path; the existing
  `get_session_for_update` stays for the login/logout/expiry write
  paths.
- The existing test suite in `backend/tests/test_auth.py` passes
  unchanged. One new test is added that exercises the
  "concurrent login on a different connection invalidates the old
  cookie; the next request on the old cookie returns
  `session_invalidated`" contract end-to-end.

### Phase 2 — Throttle `touch_session`

- After this phase: `touch_session` is invoked from the read path
  only when `now() - last_seen_at >= session_touch_throttle_seconds`.
- A new `Settings` field `session_touch_throttle_seconds: int = 60`
  is added to `backend/config.py`. Default `60`. Configurable per
  environment.
- The cookie returned in the response continues to reflect the
  intended sliding `expires_at` computed locally — i.e., the cookie
  expiry slides smoothly even when the DB write is skipped. The
  DB-stored `expires_at` may trail by up to
  `session_touch_throttle_seconds`.
- The joined SELECT from Phase 1 must return `last_seen_at` (one
  extra column) so the throttle decision is local.
- A test asserts: within the throttle window, two back-to-back
  requests cause **one** DB UPDATE (or zero, depending on initial
  `last_seen_at` baseline); past the window, the next request causes
  the UPDATE.
- A test asserts the cookie `expires_at` returned in the response
  advances on **every** authenticated request, regardless of whether
  the DB write was skipped.

### Phase 3 — In-process session cache (Deferred)

- This phase does **not** ship as part of this feature. It is held
  here as a written design so a future maintainer does not have to
  re-derive the tradeoffs.
- The phase doc describes the cache shape (key, value, TTL),
  documents the cross-worker staleness window as the primary risk,
  and lists prerequisites (a Postgres `LISTEN/NOTIFY` channel from
  the writer paths, a per-worker subscriber, a documented max-
  staleness SLO).
- Re-evaluate only after Phase 1 + Phase 2 have shipped and a fresh
  profiling pass under realistic multi-worker load shows the auth
  pipeline as a real cost. Without that evidence, Phase 3 stays
  deferred.

## P4. Verification

Every shippable phase (1 and 2) must pass `make ci` from the repo
root before review.

Functional verification per phase lives in the phase doc. Performance
verification for the feature as a whole:

- Re-run the `/api/v1/auth/session` micro-benchmark after Phase 1 +
  Phase 2 land:
  - Endpoint, headers, cookie, and dataset reproduced from the
    catalog-perf measurement notes.
  - Capture: server-side handler latency (p50, p95), and DB
    statement count via `log_sql=True` for a representative 20-call
    burst.
- Targets:
  - DB statements per authenticated request: **1** in steady state
    (was 3); **2** when the throttle fires (was 3).
  - p50 handler latency reduction: ≥ 30% on the auth dependency
    portion of the trace.
  - No regression on `make ci` runtime — the test suite must not
    grow visibly slower.

Record the actual numbers in `STATUS.md` after each merge.

## P5. Risk / mitigations

- **Security boundary changes.** This is the only material risk and
  the whole audit was written to bound it. Mitigations:
  - The single-active-session test
    (`test_single_active_session_invalidates_previous_session`,
    `test_parallel_login_attempts_do_not_escape_single_active_session`)
    must pass unchanged.
  - The expiry test (`test_expired_session_is_invalidated`) must
    pass unchanged.
  - A new explicit test for "stale cookie after a cross-connection
    login supersession returns `session_invalidated` on the next
    request" lands with Phase 1.
- **Read-path SQL shape.** The join aliases columns to avoid a
  `dict_row` collision on `id`. Phase 1 plan calls this out
  explicitly; reviewers should diff the SQL by eye.
- **Sliding cookie vs. DB drift.** Phase 2 introduces a bounded gap
  between cookie `expires_at` and DB `expires_at`. Default 60 s.
  Document the gap in the phase doc and in a comment on the
  `session_touch_throttle_seconds` setting.
- **MCP and other auth consumers.** Anything that calls
  `current_user_from_request` (the auth `CurrentUser` dependency,
  `features/projects/access.py`) gets the new behavior transparently
  — the function signature does not change. Phase 1 plan greps for
  consumers as a sanity check.

## P6. Sequencing

Recommended merge order:

1. **Phase 1** — Drop read-path lock + collapse the two `SELECT`s.
   Strictly larger win than Phase 2 because it removes the row lock
   too, not just a round-trip. Ship first.
2. **Phase 2** — Throttle `touch_session`. Independent of Phase 1
   but easier to reason about once the read path is one statement.
3. **Re-measure.** Capture the new numbers in `STATUS.md`. If the
   auth dependency no longer shows up as a meaningful slice of a
   typical request's trace, mark Phase 3 **Deferred — confirmed by
   measurement** and stop.
4. **Phase 3** — Only revisit if step 3 shows auth still dominating
   under realistic load.

Phases 1 and 2 are independently mergeable. Phase 1 ships first
because Phase 2 piggybacks on its `last_seen_at` column addition to
the joined SELECT.

## P7. Done definition

All of:

- Phase 1 merged to `main` with `make ci` green, the existing
  `test_auth.py` suite unchanged, and the new
  cross-connection-supersession test added and passing.
- Phase 2 merged to `main` with `make ci` green, and a measurement
  entry in `STATUS.md` showing the per-request DB statement count
  dropped to 1 in steady state.
- `STATUS.md` updated with new auth-pipeline measurements vs. the
  baseline in the trigger audit.
- Phase 3 explicitly marked **Deferred** in `STATUS.md` with a
  one-line note on the trigger condition that would reopen it.
- Trigger audit findings (a), (b), (c) are crossed off; finding (d)
  is acknowledged as Deferred.
