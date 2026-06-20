---
DATE: 2026-06-20
TIME: 07:58 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Source/test inventory for implementation
RELATED: planning/refactor/data-table-field-config-modal/PLAN.md
---

# References

## Source Files

- `frontend/src/shared/ui/data-table/DataTable.tsx`
  - Parent-level integration point.
  - Mounts `CreateFieldConfigModal` and `FieldConfigModal`.
  - Do not introduce per-consumer modal styling or opt-out props here.
- `frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx`
  - Edit Field modal.
  - Owns type-change draft state, conversion preflight, save bundle, field
    locks, conflict handling, and linked-record target pass-through.
- `frontend/src/shared/ui/data-table/components/CreateFieldConfigModal.tsx`
  - Add Field modal.
  - Owns new-field draft type, description, number precision,
    single-select options, formula draft, and linked-record target draft.
- `frontend/src/shared/ui/data-table/components/fieldConfigChoices.ts`
  - Single registry for custom field type choices.
  - New dropdown must use this registry.
- `frontend/src/shared/ui/data-table/components/FieldConfigSectionTypeChange.tsx`
  - Type-change preflight section.
  - Restyle as secondary/card-like information without moving preflight
    computation into the section.
- `frontend/src/shared/ui/data-table/DataTable.css`
  - Existing owner of modal, label, type-pill, and preflight styles.
  - Replacement styles should stay here.
- `frontend/src/shared/ui/AutocompleteSelect.tsx`
  - Existing shared combobox/listbox primitive.
  - Prefer reusing this for the field-type dropdown unless implementation
    friction appears.

## Tests

- `frontend/src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx`
  - Main Edit Field behavior tests.
  - Currently asserts `radiogroup` / `radio` behavior for type pills.
- `frontend/src/shared/ui/data-table/__tests__/FieldConfigModal.locks.test.tsx`
  - Field attribute lock behavior.
  - Must continue proving field-type locks prevent changes.
- `frontend/src/shared/ui/data-table/__tests__/CreateFieldConfigModal.test.tsx`
  - Add Field behavior tests.
  - Currently uses a `clickPill(...)` helper.
- `frontend/src/shared/ui/data-table/__tests__/columnHeaderDoubleClick.test.tsx`
  - Header affordance opens the shared Field Config modal.
  - Should not need large changes unless the accessible dialog name changes.
- `frontend/src/features/equipment/__tests__/RoomsTable.schemaEditor.test.tsx`
  - Consumer-level smoke for Edit Field save behavior.
  - Do not update unless it asserts old shared modal internals.

## Static Greps

Use these after implementation:

```bash
rg -n "data-table-field-config-modal-title|data-table-add-field-label|data-table-add-field-type-row|data-table-add-field-type-pill" frontend/src
```

Expected: no matches.

```bash
rg -n "FieldConfigModal|CreateFieldConfigModal" frontend/src --glob '!**/__tests__/**'
```

Expected: definitions/imports in the shared DATA-TABLE package and
existing comments only; no feature route should instantiate a modal.

```bash
rg -n "role=\"radiogroup\"|role=\"radio\"|clickPill|data-table-add-field-type-pill" frontend/src/shared/ui/data-table frontend/src/features --glob '*test*'
```

Expected: no remaining assertions tied to the old type-pill UI.

