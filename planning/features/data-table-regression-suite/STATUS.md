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

`Phase 03 complete - route smoke matrix green across all 14 tables`.

Phase 01 shipped the typed table matrix and reusable e2e harness; Phase 02
pinned the shared edit contract (React-free) in
`sharedEditContract.test.ts`. Phase 03 now adds
`frontend/tests/e2e/table-regression/table-smoke.spec.ts`: one
`@table-smoke` test per matrix entry that deep-links to the route,
asserts every default-visible header, asserts the grid body rendered
(data row *or* empty-state cell), and asserts no captured
`console.error`/`pageerror`. One agent session + one project is reused
across all 14 tables (read-only navigation, no state leak). Four reusable
helpers were added to `tableHelpers.ts`
(`headerByLabel`, `expectHeadersVisible`, `expectGridBodyRendered`,
`attachConsoleErrorSink`). The run also confirmed the Phase 01 matrix
against the live DOM — every route, region name, add-button label, and
header resolved. See `phases/phase-03-route-smoke-matrix.md`.

## Next Step

Phase 04: cell behavior matrix. Parameterize text/number edits across
every table with a representative field, single-select behavior across
tables with built-in selects, and linked-record behavior only where a
real linked-record field + deterministic target data exist. Assert DOM
display, route reload, and draft-payload persistence. See
`phases/phase-04-cell-behavior-matrix.md`.

## Phase Status

| Phase | State | Pointer |
|---|---|---|
| 00 - Planning packet | Complete | `phases/phase-00-planning-packet.md` |
| 01 - Inventory and harness design | Complete | `phases/phase-01-inventory-and-harness.md` |
| 02 - Shared DataTable contract tests | Complete | `phases/phase-02-shared-contract-tests.md` |
| 03 - Route smoke matrix | Complete | `phases/phase-03-route-smoke-matrix.md` |
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

Phase 03: `E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec
playwright test tests/e2e/table-regression --grep @table-smoke` →
14 passed (7.8s), zero captured browser errors. Requires the local
frontend (5173) + backend (8000) running and the seeded agent account
(`make seed-agent-user`).

