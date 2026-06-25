---
DATE: 2026-06-24
TIME: 20:44 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Status chip styling and global chip-style decision.
RELATED:
  - planning/features/data-table-ui/PLAN.md
  - frontend/src/shared/ui/data-table/components/SingleSelectCell.tsx
  - context/technical-requirements/data-table.md
---

# Phase 03 - Chip System

## Goals

- Improve status chip readability and semantics.
- Decide whether solid-fill chips with white text should become the
  shared DataTable chip style.

## Tasks

- Inventory current chip renderers: `single_select`, status, linked
  records, toolbar/filter/sort/group indicators, missing-option states,
  and duplicate-record warnings.
- Prototype status chips with semantic colors, tighter type, and icons
  for Complete / Needed where useful.
- Compare global solid chips against a narrower status-only solid style
  in dense rows.
- Treat DESIGN-agent numeric-prefix stripping as an explicit per-field
  presentation option, not a global single-select behavior.
- Keep linked-record chips legible when many values are clipped in one
  cell.

## Acceptance

- Status chips scan clearly at table density.
- The solid-chip decision is documented before broad CSS changes land.
- Existing option colors remain meaningful or have a documented
  replacement.
