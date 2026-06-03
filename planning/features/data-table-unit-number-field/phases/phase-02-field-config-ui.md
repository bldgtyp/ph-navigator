---
DATE: 2026-06-03
TIME: 17:12 EDT
STATUS: Complete on branch codex/data-table-number-units
AUTHOR: Codex
SCOPE: Field config modal UX and schema mutation handling for Number
       with Units.
RELATED:
  - ../PRD.md
  - phase-01-contract-and-registry.md
  - frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionNumber.tsx
  - frontend/src/shared/ui/data-table/lib/customFieldMutations.ts
  - backend/features/project_document/mutations/bundle.py
---

# Phase 02 - Field Config UI

## Objective

Let users add, edit, and remove unit config on Number fields while
respecting fixed feature-owned unit config.

## User Behavior

- Type picker still shows `Number`.
- Number section shows existing decimal precision for plain Number
  fields.
- Number fields can expose an `Add units` control.
- Once units are present, the modal describes the field as
  `Number with Units`.
- Unitized Number fields show:
  - Unit type;
  - SI unit;
  - IP unit;
  - SI decimal precision;
  - IP decimal precision;
  - Remove units when `mode === "editable"`.
- Fixed unit config renders read-only controls with the normal
  locked-field affordance.

## Backend Work

- Ensure `editFieldBundle` / relevant schema mutation paths reject:
  - partial unit config;
  - unit config edits when existing config is `mode: "fixed"`;
  - unit config on non-number destinations.
- Ensure changing a field away from Number strips unit config before
  validation.
- Ensure changing into Number creates plain Number unless the client
  supplies a complete editable unit config in the same bundle.
- Add backend tests for each mutation path.

## Frontend Work

- Add `FieldConfigSectionUnits` or equivalent small component.
- Update `FieldConfigModal` dirty-state and payload construction for:
  - adding units;
  - editing unit type / unit pair / precision;
  - removing units;
  - preserving fixed unit config unchanged.
- Extend local type-change preflight only where needed; type changes
  still use existing Number coercion.
- Add tests:
  - plain Number dialog unchanged;
  - Add units requires complete pair before save;
  - fixed units are visible but disabled;
  - removing units preserves cell values and emits only schema config
    change;
  - changing Number with Units to Single-select drops unit config.

## Verification

- Focused FieldConfigModal tests.
- Focused schema-mutation backend tests.
- Frontend typecheck for data-table modules.

## Handoff Criteria

- Users can author editable unit config through the modal.
- Fixed unit config cannot be changed through UI or backend mutation.
- Type-change semantics match the PRD without new cell coercion rules.

## Completion Notes

Completed 2026-06-03 on branch `codex/data-table-number-units`.

Frontend:

- Added `FieldConfigSectionNumberUnits` for Add Units, unit-type/unit
  pair controls, SI/IP precision controls, Remove Units, and fixed
  read-only messaging.
- Extended `FieldConfigModal` number draft state, dirty checking,
  conflict detection, discard behavior, and save payloads for
  `numberUnits`.
- Extended `EditCustomFieldBundleRequest` and
  `buildNextConfigForFieldTypeChange` so Number config preserves,
  adds, removes, or strips `config.units` according to the target type.
- Added compact modal CSS for the unit control grid and fixed-unit hint.

Backend:

- `editFieldBundle` rejects changes/removal of existing
  `mode: "fixed"` unit config.
- Direct `changeType` rejects the same fixed-unit bypass.
- Number-to-Single-select is now an allowed conversion and maps numeric
  values through canonical text labels before option lookup.

Simplify pass:

- Reuse reviewer: reused `DEFAULT_NUMBER_PRECISION` in Add Units and
  added a local backend test helper for unit config literals.
- Quality reviewer: fixed Number-to-Single-select numeric mapping and
  added fixed-unit enforcement to direct `changeType`.
- Efficiency reviewer: no issues.

Focused verification:

- `cd backend && uv run ruff check features/project_document/mutations/models.py features/project_document/mutations/bundle.py features/project_document/mutations/type_conversion.py tests/test_project_document_schema_mutations.py`
- `cd backend && uv run ty check`
- `cd backend && uv run pytest tests/test_project_document_schema_mutations.py`
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/customFieldMutations.test.ts`
- `cd frontend && pnpm run lint`
- `cd frontend && pnpm run build`

Full mandatory gate completed before commit:

- `make format`
- `make ci`

Phase 03 has not started; implementation is paused for review.
