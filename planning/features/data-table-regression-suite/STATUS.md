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

`Phase 05 complete - linked-record flows green (3 tests; 46/46 across the
whole table-regression suite)`.

Phase 05 adds
`frontend/tests/e2e/table-regression/table-linked-records.spec.ts`
(`@table-links`): Rooms -> Space Types with the inverse "Rooms <- Space
Type" column; HP Equipment Outdoor -> paired Indoor Equipment; and HP
Units Indoor -> Indoor Equipment + Outdoor Unit (add-dialog links) +
served Rooms (grid multi-link). Determinism comes from seeding exactly one
row per target table, so "link the first candidate" is unambiguous;
correctness is asserted from the draft payload (the stored link id equals
the seeded target's row id) via the new `readRowLinkIds` (custom_links /
typed column / legacy custom_values aware). New table-agnostic helpers:
`openGridPicker`, `confirmPickerSelection`, `setModalLink`, and
`addRowAndGetId(..., { modalLinks })` for required dialog picks. This phase
also seeds the two HP unit leaves deferred from Phase 04. Rooms -> Pumps
stays covered by `record-linking-rooms-pumps.spec.ts`.

(The original "Phase 05 - deep links and view state" was split: the
table-view-state matrix is Phase 06, and run policy is Phase 07.)

### Earlier phases

`Phase 04 - cell behavior matrix green (13 tests, ~32s)`.

Phase 01 shipped the typed table matrix and reusable e2e harness; Phase 02
pinned the shared edit contract (React-free) in
`sharedEditContract.test.ts`; Phase 03 added the `@table-smoke` route
matrix. Phase 04 now adds
`frontend/tests/e2e/table-regression/table-cell-behavior.spec.ts`: one
`@table-behavior` test per in-scope table that seeds a row, edits its
representative text + number + single-select cells, asserts the grid
display, reloads the route, re-asserts persistence, and reads the
draft-table payload to prove the persisted value *shape* (finite number;
single-select stores an option id, not the label). A dedicated test
proves blank nullable text/number clear to `null` (never `""` / `0`).
New `tableHelpers.ts` helpers: `addRowAndGetId` (inline + dialog add,
auto-seeds the row Tag), `commitSingleSelect`, `findDraftRow`,
`readRowFieldValue`; `commitCellEdit` now waits for the inline editor to
close so consecutive edits don't race the draft autosave. The matrix
gained a `singleSelectSample` per table. See
`phases/phase-04-cell-behavior-matrix.md`.

Scope notes: the two heat-pump *unit* leaves (whose add dialog needs a
linked-record pick to submit) and all linked-record grid edits are
deferred to Phase 05's deep-link flow, which owns deterministic target
seeding. Single-select runs only where a `singleSelectSample` exists —
empty-seeded selects with an unproven create path (heat-pump
`manufacturer`) are skipped; their create contract is covered by
`sharedEditContract.test.ts`.

## Next Step

Phase 06: table-view-state persistence. Prove sort / filter / hide-show /
reorder / group state persists by `(projectId, tableKey)` and survives a
route reload, across Rooms, one standard equipment table, all four
heat-pump leaves, and Thermal Bridges — and that the heat-pump leaves keep
independent state by their distinct stable keys. See
`phases/phase-06-table-view-state.md`.

## Phase Status

| Phase | State | Pointer |
|---|---|---|
| 00 - Planning packet | Complete | `phases/phase-00-planning-packet.md` |
| 01 - Inventory and harness design | Complete | `phases/phase-01-inventory-and-harness.md` |
| 02 - Shared DataTable contract tests | Complete | `phases/phase-02-shared-contract-tests.md` |
| 03 - Route smoke matrix | Complete | `phases/phase-03-route-smoke-matrix.md` |
| 04 - Cell behavior matrix | Complete | `phases/phase-04-cell-behavior-matrix.md` |
| 05 - Deep linked-record flows | Complete | `phases/phase-05-deep-links-and-view-state.md` |
| 06 - Table-view-state persistence | Planned | `phases/phase-06-table-view-state.md` |
| 07 - Run policy and documentation | Planned | `phases/phase-07-run-policy-and-docs.md` |

## Blockers

None.

## Open Decisions

- ~~e2e auth default account~~ — resolved in Phase 01: the table suite
  uses `signInForTables` (defaults to `codex@example.com`,
  env-overridable); the shared `signIn` default is left as
  `ed@example.com` so existing specs and CI are untouched.
- ~~API setup versus UI setup for deterministic table rows~~ — resolved
  for Phase 04: behavior tests seed rows through the real UI
  (`addRowAndGetId`) and read the draft API back only to assert the
  persisted value *shape* (`readDraftTable` + `findDraftRow` +
  `readRowFieldValue`). Phase 05 may revisit for linked-record target
  seeding.
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

Phase 04: `E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec
playwright test tests/e2e/table-regression --grep @table-behavior` →
13 passed (~32s), zero captured browser errors. Same local stack +
seeded agent account preconditions as Phase 03. `pnpm exec tsc -b` and
ESLint are clean on the changed files; the no-browser `@table-harness`
sanity suite still passes 16/16.

Phase 05: `E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec
playwright test tests/e2e/table-regression --grep @table-links` →
3 passed (~17s), zero captured browser errors. The full
`tests/e2e/table-regression` directory (harness + smoke + behavior +
links) is 46/46 green (~1.4m). Same local stack + seeded agent account
preconditions.

