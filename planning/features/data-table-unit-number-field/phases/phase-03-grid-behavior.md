---
DATE: 2026-06-03
TIME: 17:12 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: DataTable render, edit, paste, filter, aggregation, and view
       behavior for Number with Units.
RELATED:
  - ../PRD.md
  - phase-01-contract-and-registry.md
  - phase-02-field-config-ui.md
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/components/GridHeader.tsx
  - frontend/src/shared/ui/data-table/components/GridBody.tsx
  - frontend/src/shared/ui/data-table/fields/
  - frontend/src/shared/ui/data-table/lib/paste/
---

# Phase 03 - Grid Behavior

## Objective

Make the table behave correctly after a Number field has unit config.

## Display Rules

- Unit label appears in the field header only.
- Cells render bare numbers with the active system's precision:
  - SI mode: stored value in `si_unit`;
  - IP mode: converted value in `ip_unit`.
- Empty/null cells render the existing empty state.
- Plain Number fields render exactly as today.

## Edit And Clipboard Rules

- Inline edit seeds from the displayed bare number.
- Commit parses the bare number in the active display unit and writes
  canonical SI numeric value.
- Paste parses bare numbers in the active display unit.
- Copy emits the displayed bare number with no suffix.
- Fill copies the stored canonical numeric value, same as plain Number.
- Explicit suffix parsing is deferred.

## Filter And View-State Rules

- MVP keeps Number filter UI.
- Filter comparison should use the active displayed value consistently
  with edit/display behavior.
- When unit config changes, remove persisted filters for that field.
- Preserve unrelated view state: sort, group, widths, hidden columns,
  filters on other fields.
- Decide implementation location during coding:
  - schema-mutation response may include affected field id so the
    caller sanitizes local/persisted view state; or
  - view-state sanitizer compares prior/next field unit config.

## Aggregation Rules

- Aggregate stored canonical numeric values.
- Render aggregate as a bare number in the active unit system.
- Keep existing Number aggregation options, including `sum`, for MVP.

## Frontend Work

- Add unit-aware number formatter/parser used by:
  - cell render;
  - inline number editor;
  - paste coercion;
  - aggregation display;
  - filter comparison;
  - fit-to-content measurement.
- Add header unit label rendering without putting units in every cell.
- Ensure global unit toggle re-renders cells and headers without
  creating a draft.
- Preserve active editor draft text across global unit toggle.

## Tests

- Unitized cell renders SI and IP bare numbers.
- Header shows active unit label.
- Editing in IP writes SI canonical numeric value.
- Paste in IP writes SI canonical numeric values.
- Copy in IP copies bare displayed numbers.
- Global toggle does not call `onWrite`.
- Active editor draft survives toggle.
- Unit config change clears filters for that field only.
- Aggregation display changes with unit preference.

## Handoff Criteria

- Grid operations are indistinguishable from Number except display/input
  conversion and header unit label.
- No suffixes appear in cells, copy output, or paste requirements.
- Unit preference toggling is render-only.
