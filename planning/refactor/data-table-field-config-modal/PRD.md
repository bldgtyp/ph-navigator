---
DATE: 2026-06-20
TIME: 07:58 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Shared DATA-TABLE Field Config modal UX contract
RELATED: planning/refactor/data-table-field-config-modal/README.md
---

# PRD

## Goal

Make the DATA-TABLE Add/Edit Field modal feel closer to Airtable's field
editor while preserving PH-Navigator's shared DATA-TABLE contract.

The first control should be the field name. The type control should read
as one select/dropdown, not a cluster of pills. Labels and preflight
content should not compete with the primary name/type controls.

## Non-Negotiables

- The change lands in the shared DATA-TABLE parent layer only:
  `frontend/src/shared/ui/data-table/**`.
- All DATA-TABLE consumers inherit the same modal behavior through
  `DataTable.tsx`.
- No feature route may create its own Field Config modal, override this
  modal with page-local CSS, or choose a different field-type picker.
- Accessibility must remain intact even when visible labels are removed.

## Required UI Changes

1. Remove the visible `data-table-field-config-modal-title` treatment.
   Keep an accessible dialog name using `Dialog.Title` with `.sr-only` or
   an equivalent Radix-supported accessible label. The old CSS class
   should be removed.
2. Retire `data-table-add-field-label` from the modal DOM/CSS.
   - Name, Type, and Description labels should be visually absent or
     replaced by control-native affordances.
   - Type-specific settings that still need visible labels should use a
     new modal-specific low-emphasis class, not the old uppercase add-field
     label class.
3. Replace `data-table-add-field-type-row` and
   `data-table-add-field-type-pill` with one shared field-type dropdown.
   - Use the existing `FIELD_TYPE_CHOICES` registry.
   - Preserve disabled conversion targets in Edit Field.
   - Preserve the current "Number with units displays as Unit" label
     behavior.
   - Use the same component in `FieldConfigModal` and
     `CreateFieldConfigModal`.
4. Restyle `data-table-field-config-typechange` as secondary information.
   - Add a subtle bordered/card-like surface inside the modal.
   - Use smaller text and muted colors.
   - Keep the row-preservation summary readable.
   - Keep the acknowledgement checkbox prominent enough when data will be
     cleared.

## Deferred

- Collapsing Description behind an Airtable-style "Add description" action
  is not required for the first pass. Keep the current textarea contract
  unless Ed explicitly wants the collapsed behavior.
- Adding field-type icons/search is optional. The current custom field type
  list is small; the important change is one select/dropdown control
  instead of pills.

