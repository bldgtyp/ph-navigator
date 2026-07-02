---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Implementation plan for shared DataTable visual overflow polish.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
---

# PLAN - DataTable Visual Overflow Polish

## Phase 01 - Header and Clipping - Complete

- Inspect DataTable sticky header CSS and token usage.
- Replace translucent header backgrounds with opaque equivalents.
- Inspect fixed-column/gutter/body clipping containers.
- Align bottom clipping across fixed and scrollable table regions.

## Phase 02 - Linked-Record Cell Overflow - Complete

- Locate linked-record cell renderer.
- Set minimum pill dimensions and stable row-height behavior.
- Add horizontal overflow handling inside the cell.
- Add a clear `...`/overflow cue when content is clipped.

## Phase 03 - Verification - Complete

- Run focused frontend/DataTable tests.
- Browser-smoke Catalogs / Frame Types long-table alignment and header opacity.
- Browser-smoke Spaces / Space-Types many-link cell behavior.
- Update `STATUS.md` with evidence.

## Split Guidance

This is likely two sessions: Phase 01 for table chrome/layout, Phase 02 for
linked-record overflow.
