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

`Phase 01 complete - inventory + harness skeleton landed`.

Phase 01 shipped the typed table matrix and the reusable e2e harness
under `frontend/tests/e2e/table-regression/` (`tableMatrix.ts`,
`tableHelpers.ts`, `table-harness.spec.ts`). All 14 target tables are
described once, with routes, table keys, region names, identifier
headers, core headers, representative `field_key`s, linked-record
targets, and add-row specs confirmed against the codebase. No table
*behavior* is asserted yet — the harness sanity spec only validates the
matrix and helper API (no browser).

## Next Step

Phase 02: shared DataTable contract tests (fast Vitest coverage for
text / number / single-select / linked-record commit + coercion, null
clears, required-field rejection, linked-record dedupe + `maxLinks`),
close to the shared implementation in
`frontend/src/shared/ui/data-table/`.

## Phase Status

| Phase | State | Pointer |
|---|---|---|
| 00 - Planning packet | Complete | `phases/phase-00-planning-packet.md` |
| 01 - Inventory and harness design | Complete | `phases/phase-01-inventory-and-harness.md` |
| 02 - Shared DataTable contract tests | Planned | `phases/phase-02-shared-contract-tests.md` |
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

