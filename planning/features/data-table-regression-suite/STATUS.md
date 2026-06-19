---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: In progress
AUTHOR: Ed (via Codex)
SCOPE: Current state of DataTable regression suite planning.
RELATED:
  - planning/features/data-table-regression-suite/README.md
  - planning/features/data-table-regression-suite/PRD.md
  - planning/features/data-table-regression-suite/PLAN.md
  - planning/features/data-table-regression-suite/phases/phase-00-planning-packet.md
---

# DataTable Regression Suite - Status

## Current State

`Phase 02 complete - shared DataTable edit contract pinned`.

Phase 01 shipped the typed table matrix and reusable e2e harness under
`frontend/tests/e2e/table-regression/`. Phase 02 then established the
shared edit contract as a single, React-free source of truth:
`frontend/src/shared/ui/data-table/__tests__/sharedEditContract.test.ts`
(19 tests) drives the now-exported pure commit planners (`planCommit`,
`planLinkedRecord`, `decideSingleSelectCommit`) and pins the
forward/inverse op pairing per editor kind. An existing-coverage audit
showed the mature DataTable suite already covered the behaviors, so
Phase 02 consolidated + added traceability rather than duplicating
tests; see `phases/phase-02-shared-contract-tests.md` for the decision
record and the behavior→test map.

## Next Step

Phase 03: route smoke matrix. Add a Playwright smoke spec parameterized
over all 14 target tables — sign in, open each table, assert expected
headers + grid cells exist, assert no browser runtime error. Keep
assertions shallow so mount/render regressions isolate from edit
regressions. See `phases/phase-03-route-smoke-matrix.md`.

## Phase Status

| Phase | State | Pointer |
|---|---|---|
| 00 - Planning packet | Complete | `phases/phase-00-planning-packet.md` |
| 01 - Inventory and harness design | Complete | `phases/phase-01-inventory-and-harness.md` |
| 02 - Shared DataTable contract tests | Complete | `phases/phase-02-shared-contract-tests.md` |
| 03 - Route smoke matrix | Planned | `phases/phase-03-route-smoke-matrix.md` |
| 04 - Cell behavior matrix | Planned | `phases/phase-04-cell-behavior-matrix.md` |
| 05 - Deep links and view state | Planned | `phases/phase-05-deep-links-and-view-state.md` |
| 06 - Run policy and documentation | Planned | `phases/phase-06-run-policy-and-docs.md` |

## Blockers

None.

## Open Decisions

- ~~e2e auth default account~~ — resolved in Phase 01: the table suite
  uses `signInForTables` (defaults to `codex@example.com`,
  env-overridable); the shared `signIn` default is left as
  `ed@example.com` so existing specs and CI are untouched.
- API setup versus UI setup for deterministic table rows — harness now
  supports both (matrix add-row specs for UI seeding; `readDraftTable`
  for API read-back). The seeding choice per behavior phase is still open.
- Initial CI policy for the smoke suite.
- Whether visual/screenshot checks are part of v1 or deferred.
- Whether to create package scripts immediately or after local
  stabilization (Phase 06).

## Verification

Phase 01: `pnpm exec playwright test --list tests/e2e/table-regression`
lists 17 entries. The no-browser harness sanity spec passes 17/17.
Prettier + ESLint clean on the new files. No browser/server behavior is
asserted yet (by design for this phase).

