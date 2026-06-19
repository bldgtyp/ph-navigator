---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Planned
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

