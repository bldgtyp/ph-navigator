---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: Fast shared DataTable contract coverage.
RELATED:
  - planning/features/data-table-regression-suite/PLAN.md
  - frontend/src/shared/ui/data-table/hooks/useGridEdit.ts
  - frontend/src/shared/ui/data-table/lib/rows/defaults.ts
  - frontend/src/shared/ui/data-table/components/GridBody.tsx
---

# Phase 02 - Shared DataTable Contract Tests

## Goal

Verify shared DataTable behavior once, close to the shared implementation,
so the browser matrix does not need to rediscover every low-level edit
contract on every route.

## Planned Tasks

1. Test text edit commit planning.
2. Test numeric edit commit planning and numeric display round trip.
3. Test nullable clear behavior for text, number, and single-select.
4. Test required clear rejection.
5. Test single-select existing-option selection.
6. Test single-select create-option behavior where allowed.
7. Test linked-record selection, dedupe, and `maxLinks`.
8. Test stable cell selectors: `role="gridcell"`, `data-row-id`, and
   `data-field-key`.
9. Test unit-field display if the shared harness can do so without brittle
   route setup.

## Deliverables

- Focused Vitest coverage under the shared DataTable test area.
- Clear separation between shared behavior failures and route wiring
  failures.

## Verification

```bash
cd frontend && pnpm exec vitest run src/shared/ui/data-table
```

## Outcome

Complete. The audit-first finding drove the implementation shape.

### Decision — consolidate, don't duplicate

Before writing any test, an existing-coverage audit showed the shared
edit contract was **already verified** by the DataTable's own mature
suite (built organically during the record-linking and number-units
work). Re-authoring the planned `grid-edit-contract` /
`field-value-coercion` / `linked-record-editing` specs would have
duplicated passing tests. With Ed's sign-off, Phase 02 instead:

1. **Exposed the pure commit planners** in
   `frontend/src/shared/ui/data-table/hooks/useGridEdit.ts` —
   `planCommit`, `planLinkedRecord`, `decideSingleSelectCommit`, and the
   `CommitPlan` type are now exported. The file's own comment already
   declared these "directly unit-testable"; they were not exported or
   tested directly until now. `planCommit`'s redundant `editor` argument
   was dropped (it derives `current.editor` internally).
2. **Added one authoritative contract spec** —
   `frontend/src/shared/ui/data-table/__tests__/sharedEditContract.test.ts`
   (19 tests). It drives the pure planners with no React/jsdom and pins
   the **forward + inverse op pairing** per editor kind — the undo
   contract every route's writes depend on. It deliberately closes the
   one genuine gap: the single-select *create* inverse
   (`removedOptions`), which `useGridEdit.test.ts:334` left implicit.

### Traceability — where each contract behavior is verified once

| # | Contract behavior | Verified by |
|---|---|---|
| 1 | Text edit commit | `sharedEditContract.test.ts` §Text · `useGridEdit.test.ts:189` |
| 2 | Numeric commit + units round-trip | `sharedEditContract.test.ts` §Number · `numberUnitsGrid.test.tsx:269` |
| 3 | Nullable clear → `null` (not `""`/`0`) | `sharedEditContract.test.ts` §Text/§Number · `lib.test.ts:275` · `rowDefaultsColor.test.ts` (color) |
| 4 | Required-clear rejection | `sharedEditContract.test.ts` §Text/§Number · `lib.test.ts:305` · `DataTable.test.tsx:408` |
| 5 | Single-select existing option | `sharedEditContract.test.ts` §Single-select · `SingleSelectPopover.test.tsx` |
| 6 | Single-select create option | `sharedEditContract.test.ts` §Single-select (incl. inverse `removedOptions`) |
| 7 | Linked-record dedupe + `maxLinks` | `sharedEditContract.test.ts` §Linked-record · `linkedRecordPaste.test.ts` |
| 8 | Stable cell selectors (`gridcell`/`data-row-id`/`data-field-key`) | `GridBody.test.tsx:57` (DOM-level) |
| 9 | Unit-field display | `numberUnitsGrid.test.tsx:94` (DOM-level) |

Behaviors 8–9 are observable only through the rendered grid, so they
remain in their DOM specs; the contract spec's header indexes them so
the file reads as the complete contract map.

### Note on single-select required-clear

A single-select cleared from the popover plans a **no-op**
(`decideSingleSelectCommit` returns `noop` on blank), not a rejection.
The required-clear *rejection* fires on the coerce/Delete-key path and
is covered by `lib.test.ts:305`. The contract spec documents both halves
so the distinction is not lost.

### Deferred

Folding these accepted contracts into
`context/technical-requirements/data-table.md` is Phase 06 work, per the
plan — not duplicated here.

### Verification result

`pnpm exec vitest run src/shared/ui/data-table` → 76 files, 957 tests
pass (19 in the new contract spec). Prettier + ESLint clean on the new
and changed files.

