---
DATE: 2026-06-04
TIME: 11:30 ET
STATUS: Active — PRD locked, no implementation yet. Awaiting Phase 1
        kickoff.
AUTHOR: Claude (Opus 4.7)
SCOPE: Status ledger for the auth-session-perf feature. Updated at the
       end of every implementation session.
RELATED:
  - README.md
  - PRD.md
  - phases/phase-01-collapse-reads-and-drop-lock.md
  - phases/phase-02-throttle-touch-session.md
  - phases/phase-03-session-cache.md
  - planning/code-reviews/2026-06-04/auth-current-user-pipeline-review.md
---

# Auth Session Pipeline Performance — Status

## Current state

PRD is locked. No code changes have landed yet. Ready to hand off
Phase 1.

## Phase ledger

| Phase | Title | Status | Branch / PR | Verification |
|---|---|---|---|---|
| 1 | Drop read-path `FOR UPDATE` + collapse SELECTs into one JOIN | Pending | — | not yet measured |
| 2 | Throttle `touch_session` | Pending | — | not yet measured |
| 3 | In-process session cache | Deferred — design only | — | gated on Phase 1 + 2 re-measurement |

## Baseline (from trigger audit)

Captured 2026-06-04 against `localhost`, single uvicorn worker, no
throttling. **These are the numbers each phase will be compared
against.**

- Per authenticated request, steady-state success path:
  - DB transactions: **1** (`BEGIN` / `COMMIT`)
  - DB statements: **3** (`SELECT FOR UPDATE` + `SELECT` + `UPDATE`)
  - Row locks acquired: **1** (on `sessions.id`)
- Audit estimate of per-request cost: **3–8 ms** of the typical
  ~25 ms `/api/v1/catalogs/materials` turnaround on the loopback
  interface. Scales 1:1 with API calls.
- `touch_session` writes per minute on an active user (1 click/sec):
  **~60**. Each is a row UPDATE → WAL record + dirty page.

## Targets after Phase 1 + Phase 2

- DB statements per authenticated request:
  - Steady state: **1** (the joined SELECT).
  - When throttle fires (~once per `session_touch_throttle_seconds`):
    **2** (joined SELECT + UPDATE).
- Row locks per authenticated request: **0** (login/logout/expiry
  paths keep their locks; the read path drops it).
- `touch_session` writes per minute on the same 60-clicks/min user:
  **~1** (with default `session_touch_throttle_seconds = 60`).
- No regression on existing `test_auth.py` outcomes.

## Next step

Hand Phase 1 to an implementation agent. See
`phases/phase-01-collapse-reads-and-drop-lock.md`.

## Blockers

None.

## Cross-cutting notes

- **Sibling feature** `planning/features/catalog-perf/` is doing the
  cross-cutting frontend + payload work. Both features came out of
  the same 2026-06-04 review session. They share no files.
- **`features/projects/access.py` double-call.** The audit noted
  that some edit-mode routes may resolve `current_user_from_request`
  more than once per request because `optional_current_user` is
  called inline rather than as a `Depends`. Out of scope for this
  feature — flagged here so a future structural cleanup pass can
  pick it up. After Phase 1 + 2 ship, the cost of the duplication
  is much smaller anyway.
- **Cookie / DB `expires_at` drift after Phase 2.** With the default
  60 s throttle, the cookie `expires_at` will be up to 60 s ahead of
  the DB `expires_at`. The DB is the source of truth on expiry. A
  user clicking through the app should never notice. Document in
  Phase 2's `STATUS.md` entry after merge.
