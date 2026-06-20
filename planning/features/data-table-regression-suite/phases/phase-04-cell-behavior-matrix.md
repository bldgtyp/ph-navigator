---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: Browser behavior coverage for representative table cells.
RELATED:
  - planning/features/data-table-regression-suite/PLAN.md
  - context/technical-requirements/data-table.md
  - frontend/tests/e2e/table-regression/table-cell-behavior.spec.ts
---

# Phase 04 - Cell Behavior Matrix

## Goal

Use the real browser UI to verify representative text, numeric,
single-select, and linked-record behavior across the target tables.

## Planned Tasks

1. Add text-cell edit coverage for every table that has a representative
   text field.
2. Add number-cell edit coverage for every table that has a representative
   numeric field.
3. Add single-select coverage for every table with a built-in select field.
4. Add linked-record coverage only where deterministic target data is
   available.
5. Assert visible grid display after edit.
6. Reload the route and assert persistence.
7. Read draft table payloads for the cases where DOM display alone is not
   enough to prove the persisted value shape.
8. Ensure tests fail with table name, field key, route, and operation.

## Representative Field Priority

- Prefer built-in fields over custom fields for the first pass.
- Prefer simple fields that do not require modal-only workflows.
- For numeric fields, include at least one unit-bearing field.
- For linked-record fields, prioritize Rooms and Heat Pump installed-unit
  relationships before lower-risk inverse displays.

## Verification

```bash
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-behavior
```

## Outcome (implemented)

`table-cell-behavior.spec.ts` (tagged `@table-behavior`) runs one test per
in-scope table plus a dedicated null-clear test — **13 tests, ~32s, green**
against the local stack (frontend 5173 + backend 8000, seeded
`codex@example.com`). Each table test:

1. seeds a row via `addRowAndGetId` (inline or dialog add; inline rows get a
   unique Tag so required-identifier tables like Space Types stay valid);
2. edits the representative **text** and **number** cells and commits the
   representative **single-select** option;
3. asserts the live grid display, reloads the route, and re-asserts each
   value (proving persistence + stable number formatting);
4. reads the draft-table payload to prove the persisted value *shape* that
   DOM display can't: numbers store a finite number; single-selects store an
   option **id**, not the label.

Failures name the table label, field key, and operation (via `test.step`).

### Scope decisions

- **Linked-record grid edits** and the two heat-pump **unit** leaves
  (`units-outdoor`, `units-indoor`, whose add dialog requires a
  linked-record pick to submit) are **deferred to Phase 05**, which owns
  deterministic linked-record target seeding. The spec derives this
  exclusion from matrix data — it skips any case whose
  `addRow.requiresSeededTableKey` is set — so a future parent-seeded table
  is auto-deferred without editing the spec.
- **Single-select** runs only where the matrix carries a `singleSelectSample`
  (7 tables pick a template-seeded option; Rooms `floor_level` is the one
  create-mode case). Empty-seeded selects with an unproven create path
  (heat-pump `manufacturer`) are skipped; their create contract is already
  pinned by `sharedEditContract.test.ts`.
- The harness lesson worth keeping: a cell with an **open inline editor**
  reports empty text content, so `commitCellEdit` now waits for the editor to
  detach before returning — otherwise a follow-up edit starts mid-commit and
  the draft autosave's refetch clobbers it.

