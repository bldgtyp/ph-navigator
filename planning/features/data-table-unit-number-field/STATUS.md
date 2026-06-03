---
DATE: 2026-06-03
TIME: 16:42 EDT
STATUS: Phase 01 complete; Phase 02 next.
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

## Next Step

Start `phases/phase-02-field-config-ui.md`: add the edit-field modal UI
for Add/Remove units and fixed-unit read-only behavior.

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
