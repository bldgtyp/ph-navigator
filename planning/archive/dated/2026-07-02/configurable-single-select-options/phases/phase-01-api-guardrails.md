---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Done
AUTHOR: Codex
SCOPE: Backend and shared DataTable guardrails for option mutability.
RELATED:
  - ../PLAN.md
  - ../decisions.md
  - ./phase-00-contract-spike.md
---

# Phase 01 - API Guardrails

## Goal

Make option mutability enforceable before exposing new UI.

## Result

Complete.

## Scope

- Added `TableFieldRegistry.option_editable_builtin_field_keys`.
- Enforced protected built-ins in `resolve_option_target`.
- Locked built-in option edits reject with `422 custom_field_options_locked`.
- Rooms `floor_level` and `building_zone` are allowlisted.
- App-owned `status` option lists are protected.
- Added `FieldDef.optionMutability?: "editable" | "locked"`.
- Added `canEditFieldOptions` and wired it through the field-config modal,
  inline `+ Create`, and paste coercion.
- Locked option lists no longer show inline `+ Create`, and pasted unknown
  labels reject instead of emitting `newOptions`.

## Tests

- Backend: `editOptions` succeeds for Rooms `floor_level`.
- Backend: `editOptions` rejects a protected `status` field.
- Frontend: locked single-select does not show `+ Create`.
- Frontend: paste into locked single-select rejects unknown labels instead of
  emitting `newOptions`.

## Verification

- `uv run pytest tests/test_project_document_phase_3_type_conversion.py tests/features/heat_pumps/test_shared_option_cascade.py`
- `uv run ruff check features/project_document/mutations/options_ops.py features/project_document/tables/_registry_helpers.py features/project_document/tables/contracts.py features/project_document/tables/heat_pumps.py features/project_document/tables/rooms.py tests/test_project_document_phase_3_type_conversion.py tests/features/heat_pumps/test_shared_option_cascade.py`
- `pnpm vitest run src/shared/ui/data-table/__tests__/SingleSelectPopover.test.tsx src/shared/ui/data-table/__tests__/useGridEdit.test.ts src/shared/ui/data-table/__tests__/lib.test.ts`
- `pnpm exec tsc -b`
- `pnpm exec prettier --check src/shared/ui/data-table/types.ts src/shared/ui/data-table/index.ts src/shared/ui/data-table/lib/options/mutability.ts src/shared/ui/data-table/components/FieldConfigModal.tsx src/shared/ui/data-table/components/GridBody.tsx src/shared/ui/data-table/components/SingleSelectPopover.tsx src/shared/ui/data-table/hooks/useGridEdit.ts src/shared/ui/data-table/lib/rows/defaults.ts src/shared/ui/data-table/__tests__/SingleSelectPopover.test.tsx src/shared/ui/data-table/__tests__/useGridEdit.test.ts src/shared/ui/data-table/__tests__/lib.test.ts`

## Exit Criteria

- Protected option lists cannot be mutated through DataTable inline create,
  paste-created options, or REST/MCP schema mutation paths.
- Rooms `Floor` and `Zone` still accept ordinary cell value edits.
- No manage-options UI was added in this phase.
