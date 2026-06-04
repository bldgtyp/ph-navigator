---
DATE: 2026-06-04
TIME: 12:30 ET
STATUS: Complete — Phase 1 + Phase 2 merged to main, Phase 3 Deferred.
AUTHOR: Claude (Opus 4.7)
SCOPE: Status ledger for the auth-session-perf feature.
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

Both shippable phases landed. Phase 3 stays Deferred behind the
measurement trigger defined in `phases/phase-03-session-cache.md` §P0.

## Phase ledger

| Phase | Title | Status | Branch / PR | Verification |
|---|---|---|---|---|
| 1 | Drop read-path `FOR UPDATE` + collapse SELECTs into one JOIN | Merged to main | PR #9 (squash-merged 2026-06-04) | `make ci` green; auth suite passes incl. new supersession test |
| 2 | Throttle `touch_session` | Merged to main | PR #10 (squash-merged 2026-06-04) | `make ci` green; 18 auth tests pass incl. 3 new throttle tests |
| 3 | In-process session cache | Deferred | — | gated on §P0 trigger condition |

## Outcome vs. baseline

Baseline (captured 2026-06-04 against `localhost`, single uvicorn
worker, no throttling):

- Per authenticated request: 1 transaction, 3 statements
  (`SELECT FOR UPDATE` + `SELECT` + `UPDATE`), 1 row lock.
- `touch_session` writes per minute on an active user (1 click/sec): ~60.

After Phase 1 + 2:

- Per authenticated request, steady state: 1 transaction,
  **1 statement** (the joined unlocked SELECT), **0 row locks**.
- Per authenticated request when the throttle fires (once per
  `session_touch_throttle_seconds`): **2 statements** (joined SELECT
  + UPDATE).
- `touch_session` writes per minute on the same 60-click/min user:
  **~1** (with default `session_touch_throttle_seconds = 60`).
- All five 401 `error_code` strings preserved in their original
  precedence order. Single-active-session invariant unchanged.

## Phase 3 decision

**Deferred.** After Phase 1 + 2 the auth read path is one indexed
PK-joined SELECT served from Postgres shared buffers. The trigger to
reopen Phase 3 is defined in `phases/phase-03-session-cache.md` §P0:
≥ 2 uvicorn workers under realistic load, auth pipeline consuming
≥ 10% of a typical request, and observable connection-pool pressure.
Without that evidence, the design stays on the shelf.

## Cross-cutting notes

- **Cookie / DB `expires_at` drift after Phase 2.** With the default
  60 s throttle, the cookie `expires_at` is up to 60 s ahead of the
  DB `expires_at`. The DB is the source of truth on expiry. Documented
  inline in `backend/config.py` on the `session_touch_throttle_seconds`
  setting.
- **`features/projects/access.py` double-call.** Out of scope for this
  feature; flagged here so a future structural cleanup pass can pick
  it up. After Phase 1 + 2, the cost of the duplication is small.
- **Sibling feature** `planning/features/catalog-perf/` is the parallel
  catalog-side perf work. No shared files.

## Trigger-audit findings closeout

Per `planning/code-reviews/2026-06-04/auth-current-user-pipeline-review.md`:

- (a) Read-path `FOR UPDATE` — **Resolved** (Phase 1).
- (b) `touch_session` writes on every request — **Resolved** (Phase 2).
- (c) Two `SELECT`s collapsable into a JOIN — **Resolved** (Phase 1).
- (d) In-process session cache — **Deferred** (Phase 3, trigger documented).
