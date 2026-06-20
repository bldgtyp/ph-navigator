---
DATE: 2026-06-20
TIME: 07:58 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Current state and next steps
RELATED: planning/refactor/data-table-field-config-modal/PLAN.md
---

# Status

## Current State

Phase 02 complete. The modal is centralized in the shared DATA-TABLE
package and now uses one shared field-type dropdown/select control in both
Add Field and Edit Field flows. The modal markup/CSS now matches the
Airtable-parity direction: Name is the first visible control, Add/Edit
titles are screen-reader-only, top-level Name/Type/Description label chrome
is gone, and type-specific labels use the lower-emphasis
`.data-table-field-config-label` hook.

- `DataTable.tsx` mounts `CreateFieldConfigModal` and `FieldConfigModal`.
- `FieldTypeSelect.tsx` wraps `AutocompleteSelect` for the shared field-type
  picker contract.
- `FieldConfigModal.tsx` prepares Edit Field conversion options, preserves
  disabled forbidden targets, keeps field-type locks, and preserves the
  Number-with-Units `"Unit"` display label.
- `CreateFieldConfigModal.tsx` builds Add Field options from
  `FIELD_TYPE_CHOICES` and keeps existing type-specific sections.
- `DataTable.css` owns the new `.data-table-field-config-type-select`,
  `.data-table-field-config-label`, `.data-table-field-config-typechange`,
  and `.data-table-field-config-preflight-heading` layout hooks.
- Static search confirms `data-table-field-config-modal-title`,
  `data-table-add-field-label`, `data-table-add-field-type-row`, and
  `data-table-add-field-type-pill` are gone from `frontend/src`.

## Next Step

Implement `phases/phase-03-tests-static-guards.md`, then continue to the
browser smoke closeout.

## Completed

- `phases/phase-01-field-type-select.md` - Complete 2026-06-20 08:26 EDT.
- `phases/phase-02-modal-markup-css.md` - Complete 2026-06-20 08:45 EDT.

## Last Verification

```bash
cd frontend && pnpm exec vitest run \
  src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx \
  src/shared/ui/data-table/__tests__/FieldConfigModal.locks.test.tsx \
  src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx
cd frontend && pnpm exec vitest run \
  src/shared/ui/data-table/__tests__/DataTable.test.tsx \
  src/features/equipment/__tests__/RoomsTable.customFieldsPhase4.test.tsx
make frontend-dev-check
make format
make ci
graphify update .
rg -n "data-table-field-config-modal-title|data-table-add-field-label|data-table-add-field-type-row|data-table-add-field-type-pill" frontend/src
cd frontend && pnpm exec vitest run \
  src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx \
  src/shared/ui/data-table/__tests__/FieldConfigModal.locks.test.tsx \
  src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx \
  src/shared/ui/data-table/__tests__/DataTable.test.tsx \
  src/features/equipment/__tests__/RoomsTable.customFieldsPhase4.test.tsx
make frontend-dev-check
```

Result:

- Focused modal tests: 3 test files passed, 61 tests passed.
- Downstream stale-radio regression tests: 2 test files passed, 58 tests
  passed.
- `make frontend-dev-check`: passed with existing Fast Refresh lint
  warnings and existing Vite chunk-size warnings.
- `make ci`: passed. Backend: 903 passed, 2 skipped, 1 existing
  deprecation warning. Frontend: 181 test files passed, 1737 tests passed,
  build passed.
- `graphify update .`: graph updated. HTML export skipped because the graph
  exceeds the 5000-node visualization limit.
- Retired class search after Phase 02: no matches.
- Phase 02 focused modal/downstream tests: 5 test files passed, 119 tests
  passed.
- Phase 02 `make frontend-dev-check`: passed with existing Fast Refresh lint
  warnings and existing Vite chunk-size warnings.

## Verification Target

- Static search proves no `data-table-field-config-modal-title`,
  `data-table-add-field-label`, `data-table-add-field-type-row`, or
  `data-table-add-field-type-pill` references remain.
- Shared unit tests cover both Add Field and Edit Field modal flows.
- A browser smoke on one DATA-TABLE route proves the parent-level modal
  renders consistently for consumers.
