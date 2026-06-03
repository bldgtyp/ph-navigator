---
DATE: 2026-06-03
TIME: 18:30 EDT
STATUS: Phase 03 complete; paused for review before Phase 04.
AUTHOR: Claude (Opus 4.7)
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
- Phase 03 is complete on branch `codex/data-table-number-units`.
- `DataTable` now consumes `UnitPreferenceContext` directly (with a
  safe `"SI"` fallback for tests / unprovided hosts) and threads the
  active `unitSystem` through cell render, inline edit, clipboard
  copy/paste, filter evaluation, and aggregation. Plain Number fields
  are unchanged.
- Number-with-units cells render as bare displayed numbers (SI value
  in SI mode, converted IP value in IP mode) at the configured
  precision; the header carries a per-unit chip (`m` / `ft`, etc.).
- Inline edit seeds the draft with the displayed bare number and
  parses commit input back through the active unit system into the
  canonical SI write; paste and fill follow the same path. Copy emits
  the displayed bare number with no suffix.
- Filter operator evaluation and `formatAggregation` are unit-aware:
  user-typed filter values parse in the active display system before
  comparing SI cell values, and aggregates render in the active
  system at the configured precision.
- When a Number field's `numberUnits` config changes between renders,
  `DataTable` drops persisted filters for that field via
  `onViewChange`; unrelated view state is preserved.
- Simplify pass completed after Phase 03; `initialEditorState`
  refactored to remove a nested ternary on the unit-aware seed path
  while keeping the explanatory comment attached.

## Next Step

Pause for review. After review, start
`phases/phase-04-fixed-catalog-fields.md`.

## Verification

Phase 01 focused verification:

- `cd backend && uv run ruff check features/project_document/custom_fields.py tests/test_project_document_custom_fields.py`
- `cd backend && uv run ruff format --check features/project_document/custom_fields.py tests/test_project_document_custom_fields.py`
- `cd backend && uv run pytest tests/test_project_document_custom_fields.py`
- `cd frontend && pnpm exec vitest run src/lib/units/units.test.ts src/shared/ui/data-table/__tests__/useTableSchema.test.ts`
- `cd frontend && pnpm run lint`
- `cd frontend && pnpm run build`

Full mandatory gate completed for the Phase 02 commit:

- `make format`
- `make ci`

Phase 02 focused verification:

- `cd backend && uv run ruff check features/project_document/mutations/models.py features/project_document/mutations/bundle.py features/project_document/mutations/type_conversion.py tests/test_project_document_schema_mutations.py`
- `cd backend && uv run ty check`
- `cd backend && uv run pytest tests/test_project_document_schema_mutations.py`
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/customFieldMutations.test.ts`
- `cd frontend && pnpm run lint`
- `cd frontend && pnpm run build`

Phase 02 full verification:

- `make format`
- `make ci`

Phase 03 focused verification:

- `cd frontend && pnpm exec tsc --noEmit`
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table src/lib/units`

Phase 03 full verification:

- `make format`
- `make ci`
