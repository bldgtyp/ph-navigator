---
DATE: 2026-06-03
TIME: 16:42 EDT
STATUS: Phase 02 complete; Phase 03 next.
AUTHOR: Codex
SCOPE: Current state for the DataTable Number with Units planning
       packet.
RELATED:
  - PRD.md
---

# DataTable Number With Units Status

## Current State

- `PRD.md` defines the proposed user behavior, storage contract, table
  semantics, and remaining questions for extending Number fields with
  optional complete SI/IP unit config.
- The clarification pass resolved the user-facing model: this is
  not a separate type in the picker; it is a Number field with added
  units in the edit-field dialog.
- Catalog/domain physical fields may use fixed feature-owned unit
  config; user-created Number fields may use editable unit config.
- Area is confirmed as `m2 <> ft2`; volume is confirmed as `m3 <> ft3`.
- Unit config shape is confirmed as `config.units` with
  `mode: "editable" | "fixed"`.
- Phased implementation plans now live under `phases/`.
- Phase 01 is complete on branch `codex/data-table-number-units`.
- Backend `TableFieldDef` now validates optional complete
  `config.units` on Number fields and rejects partial, incompatible, or
  non-number unit config.
- Frontend `frontend/src/lib/units/numberUnits.ts` provides the MVP
  closed unit registry, conversion helpers, labels, and config guard.
- DataTable schema mapping exposes `FieldDef.numberUnits` for complete
  Number unit config.
- Simplify pass completed after Phase 01; findings folded in:
  precomputed frontend registry lookups, stricter frontend precision
  validation, derived TS unit unions, and backend/frontend registry
  snapshot tests.
- Phase 02 is complete on branch `codex/data-table-number-units`.
- `FieldConfigModal` now lets Number fields add, edit, and remove
  editable unit config while keeping the type picker label as `Number`.
- Fixed unit config renders in the modal but cannot be edited or
  removed; backend mutation paths reject fixed-unit edits through both
  `editFieldBundle` and direct `changeType`.
- Number fields can now change to Single-select; numeric source values
  materialize and map to generated option labels instead of clearing.
- Simplify pass completed after Phase 02; findings folded in:
  shared default number precision for Add Units, local backend test
  fixture helper for unit configs, numeric single-select coercion fix,
  and direct fixed-unit changeType guard.

## Next Step

Start `phases/phase-03-grid-behavior.md`: render headers with the
active unit label, convert unitized number display/edit values from the
global unit-system state, and invalidate filters on unit-config changes.

## Verification

Phase 01 focused verification:

- `cd backend && uv run ruff check features/project_document/custom_fields.py tests/test_project_document_custom_fields.py`
- `cd backend && uv run ruff format --check features/project_document/custom_fields.py tests/test_project_document_custom_fields.py`
- `cd backend && uv run pytest tests/test_project_document_custom_fields.py`
- `cd frontend && pnpm exec vitest run src/lib/units/units.test.ts src/shared/ui/data-table/__tests__/useTableSchema.test.ts`
- `cd frontend && pnpm run lint`
- `cd frontend && pnpm run build`

Full mandatory `make format` + `make ci` remains for final feature
closeout or before commit, per project policy.

Phase 02 focused verification:

- `cd backend && uv run ruff check features/project_document/mutations/models.py features/project_document/mutations/bundle.py features/project_document/mutations/type_conversion.py tests/test_project_document_schema_mutations.py`
- `cd backend && uv run ty check`
- `cd backend && uv run pytest tests/test_project_document_schema_mutations.py`
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/customFieldMutations.test.ts`
- `cd frontend && pnpm run lint`
- `cd frontend && pnpm run build`
