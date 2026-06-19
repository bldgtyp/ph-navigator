---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Planned
AUTHOR: Ed (via Codex)
SCOPE: Browser behavior coverage for representative table cells.
RELATED:
  - planning/features/data-table-regression-suite/PLAN.md
  - context/technical-requirements/data-table.md
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

