---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Done
AUTHOR: Codex
SCOPE: Referenced-option delete and replacement behavior.
RELATED:
  - ../PLAN.md
  - ./phase-02-rooms-affordance.md
---

# Phase 03 - Cascade UX

## Goal

Handle deletion of options currently referenced by rows with explicit, tested
behavior.

## Result

Complete.

## Scope

- Updated `FieldConfigSectionOptions` so referenced deletes choose clear or
  replacement when the field allows it.
- Carried replacement choices through `EditCustomFieldBundleRequest` and
  `editFieldBundle.optionReplacements`.
- Preserved backend required-field behavior: required built-ins must replace,
  nullable built-ins may clear.
- Showed reference counts and replacement candidates from the draft option list.

## Tests

- Delete unused option succeeds without cascade choice through the existing
  shared option-row path.
- In-use nullable Rooms option deletes can clear referenced cells.
- Replacement delete rewrites row values to the replacement option id.
- Required built-in delete without replacement is blocked in the backend.
- Required in-use delete without a replacement candidate shows a user-facing
  error and disables confirmation.

## Verification

- `uv run pytest tests/test_project_document_phase_3_type_conversion.py`
- `uv run ruff check tests/test_project_document_phase_3_type_conversion.py`
- `pnpm vitest run src/shared/ui/data-table/__tests__/FieldConfigSectionOptions.test.tsx src/features/equipment/__tests__/RoomsTable.schemaEditor.test.tsx src/shared/ui/data-table/__tests__/customFieldMutations.test.ts`
- `pnpm exec tsc -b`
- `pnpm exec prettier --check src/shared/ui/data-table/components/FieldConfigSectionOptions.tsx src/shared/ui/data-table/components/FieldConfigModal.tsx src/shared/ui/data-table/feature/useCustomFieldHandlers.ts src/shared/ui/data-table/types.ts src/shared/ui/data-table/__tests__/FieldConfigSectionOptions.test.tsx src/features/equipment/__tests__/RoomsTable.schemaEditor.test.tsx`

## Exit Criteria

- Referenced deletes no longer rely on accidental backend clearing or ad hoc
  whole-table replace behavior.
- The same cascade rules work from browser UI and direct schema mutation tests.
