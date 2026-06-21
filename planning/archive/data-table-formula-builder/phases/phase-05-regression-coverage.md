---
DATE: 2026-06-20
TIME: 09:34 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: All-table formula editor regression coverage and persisted formula smoke.
RELATED:
  - planning/archive/data-table-formula-builder/PRD.md
  - planning/archive/data-table-formula-builder/PLAN.md
  - frontend/tests/e2e/table-regression/tableMatrix.ts
  - frontend/tests/e2e/table-regression/tableHelpers.ts
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - context/technical-requirements/data-table.md
---

# Phase 05 - Regression Coverage

## Objective

Prove the formula builder changes roll out through the shared DataTable layer
to every field-config-capable DataTable, and prove at least one real saved
formula using `&` persists and computes after reload.

## Entry Conditions

- Phase 01 editor UI is complete.
- Phase 02 error card is complete.
- Phase 03 `&` grammar is complete if persisted `&` smoke is in scope.
- Phase 04 autocomplete is complete.
- Existing table-regression helpers are green in isolation, or known flakes are
  recorded in `STATUS.md`.

## Implementation Files

Frontend unit/component tests:

- `frontend/src/shared/ui/data-table/__tests__/FormulaSourceEditor.test.tsx`
- `frontend/src/shared/ui/data-table/__tests__/FormulaSuggestionPanel.test.tsx`
- `frontend/src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx`
- `frontend/src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx`
- `frontend/src/shared/ui/data-table/__tests__/DataTable.test.tsx` if direct
  DataTable modal mounting is needed.

E2E:

- `frontend/tests/e2e/table-regression/table-formula.spec.ts`
- `frontend/tests/e2e/table-regression/tableMatrix.ts`
- `frontend/tests/e2e/table-regression/tableHelpers.ts`
- `frontend/package.json` if adding a script.

Search guards:

- `frontend/src/features/**`
- `frontend/src/shared/ui/data-table/**`

## Design Contract

- The all-table test should prove shared editor presence, not duplicate every
  formula behavior on every table.
- Deep formula semantics should be tested once at shared/backend seams.
- Browser tests should be matrix-driven; table-specific exceptions must be
  documented as data in `tableMatrix.ts` or local test comments.
- Do not make the full table formula suite part of default CI unless reviewed
  separately.

## Work Plan

1. Add focused shared tests.
   - Highlighting token classes.
   - Error card rendering.
   - Suggestion filtering/insertion.
   - Add-field formula request accepts an `&` source.
   - Edit-field formula bundle dispatches an `&` source.

2. Add table formula matrix metadata if needed.
   - Identify which table surfaces allow custom field creation.
   - Identify any read-only or special table surfaces that should assert
     absence/disabled state instead of editor presence.
   - Prefer extending `TableRegressionCase` with a small `formula` capability
     object if table-specific routing/setup is needed.

3. Add `table-formula.spec.ts`.
   - Tag tests with `@table-formula` and `@table-regression`.
   - For each field-config-capable table:
     - sign in with `codex@example.com` / `password`;
     - navigate via `tableMatrix.ts`;
     - open Add field or an editable Formula field;
     - select Formula if using Add field;
     - assert shared editor role/label exists;
     - assert syntax editor classes are mounted;
     - type `{N` or another deterministic prefix and assert suggestions appear
       when the table has matching fields.

4. Add one persisted formula smoke.
   - Recommended table: Rooms, because it has deterministic `Number` and `Name`
     semantics and is already the main Display Name formula precedent.
   - Flow:
     - seed/add a Room with Number and Name;
     - add custom Formula field, e.g. `Formula Label`;
     - source: `{Number} & " - " & {Name}`;
     - save field;
     - wait for grid/computed overlay;
     - reload route;
     - assert formula column displays expected text;
     - optionally read draft table API payload and assert computed overlay.

5. Add script if useful.
   - Candidate:
     - `test:e2e:tables:formula`: `playwright test tests/e2e/table-regression --grep @table-formula`
   - Keep existing `test:e2e:tables` behavior stable unless intentionally
     broadening the suite.

6. Add search guard.
   - Use `rg` to verify no feature table imports `FormulaSourceEditor`,
     `FormulaSuggestionPanel`, or formula editor CSS directly.
   - Expected direct consumers should be shared DataTable components only.

## Acceptance Criteria

- Focused shared tests cover editor UI, errors, suggestions, and `&` modal
  flow. Complete: `CreateFieldConfigModal.test.tsx` and
  `FieldConfigModal.test.tsx` now dispatch/save `&` sources, and the full
  shared DataTable folder passed.
- Matrix e2e proves all in-scope DataTables see the shared formula editor.
  Complete: `table-formula.spec.ts` covers all 14 table-regression cases.
- At least one persisted formula with `&` computes correctly after route
  reload. Complete: Rooms saves `"Room - " & {Name}` and verifies the computed
  cell after reload.
- No table-local formula editor components or CSS are introduced. Complete:
  search guard found only shared `frontend/src/shared/ui/data-table` hits.
- Existing table smoke remains green. Complete: `@table-smoke` passed.

## Verification

Focused tests:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/data-table
```

E2E:

```bash
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-formula
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-smoke
```

Shared-import guard:

```bash
rg -n "FormulaSourceEditor|FormulaSuggestionPanel|formula-field-palette|data-table-formula-editor" frontend/src/features frontend/src/shared/ui/data-table
```

Frontend gate:

```bash
make frontend-dev-check
```

Completed verification:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/data-table
# 79 files, 980 tests passed.

cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-formula
# 15 passed.

cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-smoke
# 14 passed.

rg -n "FormulaSourceEditor|FormulaSuggestionPanel|formula-field-palette|data-table-formula-editor" frontend/src/features frontend/src/shared/ui/data-table
# shared data-table component/CSS/test hits only.

make format
# passed, no file changes.

make frontend-dev-check
# passed; existing 13 Fast Refresh warnings, no errors.

make ci
# passed: backend 912 passed, 2 skipped; frontend 184 files, 1760 tests, build passed.
```

## Risks And Watchpoints

- Creating custom fields in every table may be slow or flaky. The all-table
  test can assert editor presence through the Add field modal without saving on
  every route; save/persist should be one or two focused flows.
- Some tables may need seed rows before formula preview can show a value. Do
  not let preview requirements block the editor-presence matrix.
- Existing full-directory table-regression flake should not be confused with a
  formula regression; run tagged subsets first.

## Handoff Notes

This phase is where the user's "every DataTable" requirement is proven. Keep
the test data matrix-driven and name failures by `case.id` / `case.label`.

The browser e2e must run against current-worktree servers on the canonical
local origins:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000`

During implementation, stale Dropbox-checkout servers on those ports produced
false failures: stale frontend lacked the current Add Field radio UI, and stale
backend rendered `&` formulas as evaluator `#ERROR`. Restarting both servers
from `/Users/em/.codex/worktrees/5c35/ph-navigator-v2` made the suite pass.
