---
DATE: 2026-06-24
TIME: 20:44 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Restrained frontend-design pass and browser verification.
RELATED:
  - planning/features/data-table-ui/PLAN.md
  - frontend/src/shared/ui/data-table/DataTable.css
---

# Phase 04 - Frontend Design Polish

## Goals

- Make DataTables feel more modern while staying dense and operational.
- Verify the shared style across representative real routes.

## Design direction

Use a restrained, technical table aesthetic: crisp schedule-like rows,
quiet borders, clear numeric rhythm, compact chips, and enough contrast
to scan PH inputs quickly. Avoid decorative table chrome or marketing
style.

## Tasks

- Tune row height, header height, padding, font sizes, border contrast,
  focus rings, active-cell affordances, and tint strength.
- Review visual density against routes with long labels and many unit
  columns.
- Capture screenshots for representative before/after comparison if
  useful.
- Fold stable decisions into
  `context/technical-requirements/data-table.md`.

## Acceptance

- Text does not overlap or clip incoherently in common desktop widths.
- Numeric columns, status columns, notes markers, and unit headers feel
  integrated rather than patched on.
- Focus, selection, edit, resize, reorder, and popover states remain
  visually clear.
