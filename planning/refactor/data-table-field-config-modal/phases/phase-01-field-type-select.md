---
DATE: 2026-06-20
TIME: 07:58 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Shared field-type dropdown component
RELATED: planning/refactor/data-table-field-config-modal/PLAN.md, frontend/src/shared/ui/data-table/components/fieldConfigChoices.ts
---

# Phase 01 - Field Type Select

## Goal

Replace the current field-type pill array with one shared select/dropdown
component while preserving Add/Edit modal behavior.

This phase should produce a working dropdown even before the full modal
visual cleanup lands.

## Implementation Target

Add:

```text
frontend/src/shared/ui/data-table/components/FieldTypeSelect.tsx
```

Use it from:

```text
frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx
frontend/src/shared/ui/data-table/components/CreateFieldConfigModal.tsx
```

## Preferred Component Shape

Use `AutocompleteSelect` if practical. It already provides a combobox
role, typeahead filtering, disabled options, keyboard handling, outside
click handling, and the app's select-like chrome.

Proposed props:

```ts
type FieldTypeSelectOption = {
  kind: CustomFieldType;
  label: string;
  disabled?: boolean;
  description?: string;
};

type FieldTypeSelectProps = {
  value: CustomFieldType;
  options: readonly FieldTypeSelectOption[];
  disabled?: boolean;
  onChange: (next: CustomFieldType) => void;
};
```

The component should:

- expose accessible name `Field type`;
- render one select-like control, not per-type buttons;
- use `FIELD_TYPE_CHOICES` labels;
- support disabled options for forbidden conversions;
- keep a class hook such as `data-table-field-config-type-select`;
- avoid importing feature-level code.

## Edit Field Wiring

In `FieldConfigModal.tsx`:

1. Build dropdown options from `FIELD_TYPE_CHOICES`.
2. For each candidate:
   - enable the current type;
   - enable allowed conversions from `isConversionAllowed(...)`;
   - disable forbidden conversions;
   - if the field type is locked, disable the entire select.
3. Preserve the current label override:
   - when `candidate.kind === "number"` and `numberUnits` exists, display
     `"Unit"` instead of `"Number"`.
4. On valid selection:
   - call `setDraftType(next)`;
   - call `setAcknowledged(false)`;
   - call `setServerPreflight(null)`.

Do not move preflight computation. It stays in the parent modal.

## Add Field Wiring

In `CreateFieldConfigModal.tsx`:

1. Build dropdown options directly from `FIELD_TYPE_CHOICES`.
2. On selection, call `setFieldType(next)`.
3. Keep existing draft-reset behavior when the modal opens/closes.
4. Keep existing type-specific sections:
   - `single_select` options;
   - `number` precision;
   - `linked_record` target/cardinality;
   - `formula` source.

## Acceptance Criteria

- Add Field can select every `FIELD_TYPE_CHOICES` entry through the new
  dropdown.
- Edit Field can select only current/allowed conversion targets.
- Forbidden Edit Field conversion targets are visible but disabled, or the
  whole select is disabled when field type is locked.
- Type changes still mount `FieldConfigSectionTypeChange`.
- No consumer route imports or configures `FieldTypeSelect` directly.

## Pitfalls

- Do not make `FieldTypeSelect` own conversion policy. It should receive
  already-prepared options so policy stays in `FieldConfigModal`.
- Do not use a native `select` if disabled-option messaging becomes
  unreadable. Use `AutocompleteSelect` descriptions for disabled reasons.
- Do not remove the existing pill CSS in this phase unless tests are already
  updated; Phase 02 performs final CSS retirement.

