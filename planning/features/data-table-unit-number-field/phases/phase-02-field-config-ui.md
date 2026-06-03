---
DATE: 2026-06-03
TIME: 17:12 EDT
STATUS: Planned
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
