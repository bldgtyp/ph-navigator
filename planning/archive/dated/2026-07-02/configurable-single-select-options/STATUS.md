---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Archived
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
  - ./phases/phase-02-rooms-affordance.md
  - ./phases/phase-03-cascade-ux.md
  - ./phases/phase-04-verification-docs.md
---

# STATUS - Configurable Single-Select Options

## State

`Archived` - Implemented and archived on 2026-07-02.

## Next Step

No active next step. The packet now lives under
`planning/archive/dated/2026-07-02/configurable-single-select-options/`.

## Blockers

None.

## Decisions

- Contract: `option_mutability = "editable" | "locked"`.
- Frontend capability: `FieldDef.optionMutability`, defaulting from
  `FieldDef.locked.includes("options")`.
- Backend capability: `TableFieldRegistry.option_editable_builtin_field_keys`.
- Allowlisted built-ins: Rooms `floor_level`, `building_zone`.
- Protected built-ins: app-owned `status` fields and other built-in
  single-selects unless explicitly allowlisted.
- Nullable Rooms referenced deletes can explicitly clear cells or replace
  references with another option.
- Rooms manage-options uses typed `editFieldBundle.nextOptions` /
  `apply_edit_options`.
- Referenced-delete replacement choices use
  `editFieldBundle.optionReplacements`.

## Implementation Notes

- Backend `editOptions` now rejects locked built-in single-select option edits
  with `422 custom_field_options_locked`.
- `TableFieldRegistry.option_editable_builtin_field_keys` allowlists editable
  built-in option lists. Rooms allows `floor_level` and `building_zone`; existing
  heat-pump project vocabularies remain allowlisted; built-in `status` is not
  allowlisted.
- Frontend DataTable uses `FieldDef.optionMutability` / `canEditFieldOptions`
  for field-config options, inline `+ Create`, and paste-created options.
- Rooms `Floor` and `Zone` no longer carry the `"options"` lock, so the shared
  field-config modal exposes editable option controls for those built-ins.
- `FieldConfigSectionOptions` now records explicit delete cascade choices.
  Required single-select fields must choose a replacement; nullable fields
  default to clear and may optionally replace.
- `EditCustomFieldBundleRequest.optionReplacements` is forwarded through
  `useCustomFieldHandlers` into the typed schema mutation builder.
- Phase 04 browser smoke found generic Equipment `status` overlays still lacked
  the frontend `"options"` lock. The backend already rejected those edits; the
  frontend now applies `STATUS_OPTION_LOCK_OVERLAY` across shared Equipment
  status tables so the modal, picker create path, and paste planner all match.

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
- 2026-07-02: Phase 02 complete. Verification:
  - `uv run pytest tests/test_project_document_phase_3_type_conversion.py`
  - `uv run ruff check tests/test_project_document_phase_3_type_conversion.py`
  - `pnpm vitest run src/features/equipment/__tests__/RoomsTable.schemaEditor.test.tsx src/shared/ui/data-table/__tests__/SingleSelectPopover.test.tsx src/shared/ui/data-table/__tests__/useGridEdit.test.ts src/shared/ui/data-table/__tests__/lib.test.ts`
  - `pnpm exec tsc -b`
  - `pnpm exec prettier --check src/features/equipment/lib.ts src/features/equipment/__tests__/RoomsTable.schemaEditor.test.tsx`
- 2026-07-02: Phase 03 complete. Verification:
  - `uv run pytest tests/test_project_document_phase_3_type_conversion.py`
  - `uv run ruff check tests/test_project_document_phase_3_type_conversion.py`
  - `pnpm vitest run src/shared/ui/data-table/__tests__/FieldConfigSectionOptions.test.tsx src/features/equipment/__tests__/RoomsTable.schemaEditor.test.tsx src/shared/ui/data-table/__tests__/customFieldMutations.test.ts`
  - `pnpm exec tsc -b`
  - `pnpm exec prettier --check src/shared/ui/data-table/components/FieldConfigSectionOptions.tsx src/shared/ui/data-table/components/FieldConfigModal.tsx src/shared/ui/data-table/feature/useCustomFieldHandlers.ts src/shared/ui/data-table/types.ts src/shared/ui/data-table/__tests__/FieldConfigSectionOptions.test.tsx src/features/equipment/__tests__/RoomsTable.schemaEditor.test.tsx`
- 2026-07-02: Phase 04 complete. Verification:
  - `uv run pytest tests/test_project_document_phase_3_type_conversion.py`
  - `uv run ruff check tests/test_project_document_phase_3_type_conversion.py`
  - `pnpm vitest run src/features/equipment/lib.test.ts src/features/equipment/__tests__/PumpsTable.reuse.test.tsx src/shared/ui/data-table/__tests__/SingleSelectPopover.test.tsx src/shared/ui/data-table/__tests__/useGridEdit.test.ts src/shared/ui/data-table/__tests__/lib.test.ts`
  - `pnpm exec tsc -b`
  - `pnpm exec prettier --check src/features/equipment/lib.ts src/features/equipment/lib.test.ts src/features/equipment/__tests__/PumpsTable.reuse.test.tsx`
  - Browser smoke through in-app Browser at `http://localhost:5173` with
    `codex@example.com`: Rooms Floor add + alphabetize + unused delete +
    referenced delete clear; Rooms Zone add + rename; Pumps protected `Status`
    modal disabled option controls; protected `Status` picker showed no
    `+ Create` for unknown label; unknown status paste did not commit the
    bogus label. Browser console warnings/errors: none.
