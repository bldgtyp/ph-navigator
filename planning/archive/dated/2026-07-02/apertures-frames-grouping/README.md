---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Add default grouping support to the Apertures / Frames table.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
---

# Apertures Frames Grouping

## Scope

Expose DataTable grouping for Apertures / Frames:

- Default grouping should be `manufacturer`.
- `brand` should be considered as an additional grouping option if it exists as
  a real field or can be safely exposed from current metadata.

## Read Order

1. `PRD.md`
2. `PLAN.md`
3. `STATUS.md`

## Classification

`planning/features` because this adds a visible table capability to the Frames
surface.
