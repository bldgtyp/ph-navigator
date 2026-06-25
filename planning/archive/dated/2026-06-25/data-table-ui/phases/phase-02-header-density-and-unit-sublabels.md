---
DATE: 2026-06-25
TIME: 01:12 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Header layout, notes affordance, and unit sublabels.
RELATED:
  - planning/archive/dated/2026-06-25/data-table-ui/PLAN.md
  - frontend/src/shared/ui/data-table/components/SortableHeaderCell.tsx
  - frontend/src/shared/ui/data-table/components/CustomFieldDescriptionTooltip.tsx
  - frontend/src/shared/ui/data-table/DataTable.css
---

# Phase 02 - Header Density And Unit Sublabels

## Goals

- Make the header description marker compact and proportionate.
- Move unit labels under field names for `numberUnits` columns using the
  redesign's quiet badge styling.
- Add a deliberate double-height header mode that remains stable under
  resize, reorder, tinting, and field-edit states.

## Tasks

- Audit current header DOM and CSS around label, unit chip, description
  marker, lock marker, rename input, and context-menu affordance.
- Replace the stretched `"?"` marker with a compact accessible trigger.
- Define a header layout that can host one-line and two-line headers
  without layout jumps.
- Verify column drag/reorder and double-click field config still work.

## Acceptance

- Complete: unit-bearing headers now place the active unit badge under
  the field name inside `.data-table-header-title`, preserving the
  primary label line.
- Complete: unit-bearing headers add `.data-table-th--with-units`,
  with a deliberate `--data-table-header-height-units` header height.
- Complete: the description tooltip trigger is a compact icon button,
  still labeled `Description for <field>` and reachable by hover or
  keyboard focus.

## Verification

- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/CustomFieldDescriptionTooltip.test.tsx src/shared/ui/data-table/__tests__/numberUnitsGrid.test.tsx src/shared/ui/data-table/__tests__/SortableHeaderCell.test.tsx src/shared/ui/data-table/__tests__/columnHeaderDoubleClick.test.tsx`
  passed 33 tests. `numberUnitsGrid.test.tsx` still emits existing
  React `act(...)` warnings during the IP edit-commit test.
