---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Shared DataTable visual and overflow fixes for linked-record cells,
  sticky headers, and fixed-column bottom clipping.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - context/technical-requirements/data-table.md
---

# DataTable Visual Overflow Polish

## Scope

Fix three shared DataTable polish issues observed across Spaces and Catalogs:

- Linked-record cells with many links render as unreadable tiny pills.
- Sticky header backgrounds use transparency, letting body text show through.
- Fixed columns/gutter and scrollable body do not clip at the same bottom edge
  on long tables.

## Read Order

1. `PRD.md`
2. `PLAN.md`
3. `STATUS.md`

## Classification

`planning/refactor` because this is shared DataTable behavior and CSS/layout
cleanup that spans multiple feature surfaces.
