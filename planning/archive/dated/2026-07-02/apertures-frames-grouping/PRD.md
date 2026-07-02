---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Product contract for Apertures / Frames grouping.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./STATUS.md
---

# PRD - Apertures Frames Grouping

## Problem

The Apertures / Frames page lacks a useful `Group by` table view for scanning
frame types by manufacturer or brand.

## Desired Behavior

- The Frames table exposes the standard DataTable `Group by` affordance.
- The default grouping is `manufacturer`.
- `brand` is available as a grouping candidate if it exists as a real field in
  the current frame data contract.

## Acceptance Criteria

- Opening Apertures / Frames shows frames grouped by manufacturer by default.
- Users can change, ungroup, and reapply grouping through the standard DataTable
  group control.
- If `brand` exists, grouping by brand is available and produces correct groups.
- If `brand` is not a durable field, the implementation documents that decision
  and does not invent a brittle derived value.
- Existing sort/filter/hide-fields behavior remains intact.
- Focused frontend checks and browser smoke pass.

## Non-Goals

- No new catalog fields unless investigation shows `brand` already exists in the
  frame table contract but is not exposed.
- No custom grouping UI outside the shared DataTable controls.

## Investigation Notes

- Confirm whether `brand` is a stored frame field, catalog option, or derived
  from manufacturer/product naming.
- Check whether the Frames table already has table-view state support and only
  lacks default group configuration.
