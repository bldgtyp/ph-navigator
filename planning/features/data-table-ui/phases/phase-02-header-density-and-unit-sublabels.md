---
DATE: 2026-06-24
TIME: 20:44 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Header layout, notes affordance, and unit sublabels.
RELATED:
  - planning/features/data-table-ui/PLAN.md
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

- Unit-bearing headers preserve more horizontal name space.
- Header height is intentional and consistent.
- The description tooltip is still reachable by mouse and keyboard.
