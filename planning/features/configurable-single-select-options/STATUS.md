---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Current state for user-configurable single-select options.
RELATED:
  - ./README.md
  - ./decisions.md
  - ./PRD.md
  - ./PLAN.md
  - ./reviews/2026-07-02-critical-feature-review.md
  - ./phases/phase-00-contract-spike.md
  - ./phases/phase-01-api-guardrails.md
---

# STATUS - Configurable Single-Select Options

## State

`Active` - Phase 01 API/DataTable guardrails complete.

## Next Step

Start `phases/phase-02-rooms-affordance.md`.

## Blockers

None for Phase 01.

## Decisions

- Contract: `option_mutability = "editable" | "locked"`.
- Frontend capability: `FieldDef.optionMutability`, defaulting from
  `FieldDef.locked.includes("options")`.
- Backend capability: `TableFieldRegistry.option_editable_builtin_field_keys`.
- Allowlisted built-ins: Rooms `floor_level`, `building_zone`.
- Protected built-ins: app-owned `status` fields and other built-in
  single-selects unless explicitly allowlisted.
- Nullable Rooms referenced deletes clear cells; replacement UX is not required
  for Phase 02.
- Rooms manage-options uses typed `editFieldBundle.nextOptions` /
  `apply_edit_options`.

## Implementation Notes

- Backend `editOptions` now rejects locked built-in single-select option edits
  with `422 custom_field_options_locked`.
- `TableFieldRegistry.option_editable_builtin_field_keys` allowlists editable
  built-in option lists. Rooms allows `floor_level` and `building_zone`; existing
  heat-pump project vocabularies remain allowlisted; built-in `status` is not
  allowlisted.
- Frontend DataTable uses `FieldDef.optionMutability` / `canEditFieldOptions`
  for field-config options, inline `+ Create`, and paste-created options.

## Verification Ledger

- 2026-07-02: Code inspection only; no tests run.
- 2026-07-02: Phase 00 code inspection completed across DataTable
  single-select editors, paste planning, field-config options, backend
  `TableFieldRegistry`, Rooms registry, and `options_ops`. Decisions captured
  in `decisions.md`; no tests run because Phase 00 is docs/contract only.
- 2026-07-02: Phase 01 complete. Verification:
  - `uv run pytest tests/test_project_document_phase_3_type_conversion.py tests/features/heat_pumps/test_shared_option_cascade.py`
  - `uv run ruff check features/project_document/mutations/options_ops.py features/project_document/tables/_registry_helpers.py features/project_document/tables/contracts.py features/project_document/tables/heat_pumps.py features/project_document/tables/rooms.py tests/test_project_document_phase_3_type_conversion.py tests/features/heat_pumps/test_shared_option_cascade.py`
  - `pnpm vitest run src/shared/ui/data-table/__tests__/SingleSelectPopover.test.tsx src/shared/ui/data-table/__tests__/useGridEdit.test.ts src/shared/ui/data-table/__tests__/lib.test.ts`
  - `pnpm exec tsc -b`
  - `pnpm exec prettier --check src/shared/ui/data-table/types.ts src/shared/ui/data-table/index.ts src/shared/ui/data-table/lib/options/mutability.ts src/shared/ui/data-table/components/FieldConfigModal.tsx src/shared/ui/data-table/components/GridBody.tsx src/shared/ui/data-table/components/SingleSelectPopover.tsx src/shared/ui/data-table/hooks/useGridEdit.ts src/shared/ui/data-table/lib/rows/defaults.ts src/shared/ui/data-table/__tests__/SingleSelectPopover.test.tsx src/shared/ui/data-table/__tests__/useGridEdit.test.ts src/shared/ui/data-table/__tests__/lib.test.ts`
