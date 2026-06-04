# Auth Session Pipeline Performance — Planning

This folder holds the tracked planning packet for the auth session
hot-path refactor triggered by the
`auth-current-user-pipeline-review.md` audit on 2026-06-04.

The feature is small and focused: every authenticated API request
today runs a 3-statement transaction with a row lock on the
`sessions` row. The audit established that the lock and two of the
three statements are doing no useful work for the read path. This
feature ships the two safe, mechanical phases that remove that cost
and explicitly defers the speculative third (in-process session
cache) behind a measurement gate.

## Read order

1. `STATUS.md` — current state, next step, blockers, verification
2. `PRD.md` — requirements + intent + non-goals + sequencing
3. `phases/phase-01-collapse-reads-and-drop-lock.md`
4. `phases/phase-02-throttle-touch-session.md`
5. `phases/phase-03-session-cache.md` — **Deferred** until Phase 1+2
   ship and re-measurement shows auth still dominates.

## Related

- Trigger audit:
  `planning/code-reviews/2026-06-04/auth-current-user-pipeline-review.md`
- Parent perf review (where the auth finding was first flagged, §5):
  `planning/code-reviews/2026-06-04/materials-catalog-performance-review.md`
- Sibling feature (separate scope):
  `planning/features/catalog-perf/` — the catalog-perf pass
  deliberately excluded auth.

## Why a separate feature folder

The audit traversed code that has nothing to do with the catalogs
pass (`features/auth/*`, the partial unique index in the
`20260512_0002_auth_sessions` migration, `features/projects/access.py`)
and the regression risk (security boundary, single-active-session
invariant) is entirely different from "make a table render fast". Tracking
it as its own feature keeps the review surface focused.
