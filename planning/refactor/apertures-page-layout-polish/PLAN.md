---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Implementation plan for Apertures page layout polish.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
---

# PLAN - Apertures Page Layout Polish

## Phase 01 - Layout Ownership

- Inspect the Apertures / Apertures route structure and CSS.
- Identify which container lets the sidebar list determine total row height.
- Bound the sidebar and main working area so the SVG + cards stay coupled.

## Phase 02 - Sidebar Rail Polish

- Fix expanded sidebar overflow.
- Fix collapsed rail button centering and spacing.
- Verify there is no layout jump between expanded/collapsed states.

## Phase 03 - Dropdown Placement

- Trace the attribute-card select/dropdown primitive.
- Reuse existing shared viewport-aware placement if available.
- If local, add placement logic consistent with shared DataTable/select behavior.

## Phase 04 - Verification

- Run focused frontend checks.
- Browser-smoke a long-sidebar Apertures page, collapsed rail, and bottom-of-screen
  dropdown.
- Update `STATUS.md` with command and browser evidence.

