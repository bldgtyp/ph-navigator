---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Product behavior contract for shared DataTable visual overflow polish.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./STATUS.md
---

# PRD - DataTable Visual Overflow Polish

## Problem

Several shared DataTable surfaces show layout artifacts under dense data:

- Linked-record cells with many connected records compress into unreadable tiny
  bubbles, especially Spaces / Space-Types reverse `Rooms` links.
- Header background colors are achieved with transparency, so body text and
  pills bleed through sticky headers while scrolling.
- On long tables, fixed columns/gutter and the scrollable body can terminate at
  different vertical positions, leaving the fixed side visible for part of a row
  beyond the body.

## Desired Behavior

- Linked-record pills keep a readable minimum size.
- Dense linked-record cells show a clear overflow indicator such as `...` when
  content is clipped.
- Users can horizontally scroll inside a dense linked-record cell to inspect
  many links without breaking row height.
- Sticky header background colors stay visually matched to the current palette
  but are opaque, so body content cannot show through.
- Fixed row gutter, fixed columns, and scrollable body share the same bottom
  clipping boundary.

## Acceptance Criteria

- A Space-Types row linked to many Rooms shows readable link pills.
- Dense linked-record cell overflow has an explicit visual affordance.
- Horizontal scrolling inside the cell allows the user to inspect additional
  linked records.
- Header backgrounds preserve current visual colors but body text/pills are not
  visible through them.
- Long grouped Catalog / Frame Types tables show fixed columns, gutter, and body
  ending at the same bottom edge.
- Focused DataTable tests or visual smoke cover the linked-cell overflow path.
- `make frontend-dev-check` passes.
- Browser smoke covers Spaces / Space-Types and Catalogs / Frame Types.

## Non-Goals

- No redesign of the DataTable.
- No change to linked-record storage or inverse-link semantics.
- No new popover/detail surface for many links unless inline horizontal scroll
  proves insufficient during implementation.

## Investigation Notes

- The header issue may be a pure CSS opacity/token replacement.
- The bottom clipping mismatch may be CSS-only or may involve scroll container
  height math.
- Linked-record overflow needs careful row-height constraints so horizontal
  scrolling does not destabilize table geometry.
