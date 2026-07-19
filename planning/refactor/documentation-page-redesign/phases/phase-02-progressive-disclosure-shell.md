---
DATE: 2026-07-18
TIME: 22:50 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Build the Option 1A section/group/record shell over the existing summary data.
RELATED:
  - planning/refactor/documentation-page-redesign/PLAN.md
  - frontend/src/features/documentation/components/DocumentationSummaryView.tsx
  - frontend/src/features/documentation/components/DocumentationRecordViews.tsx
---

# Phase 02 - Progressive Disclosure Shell

## Goal

Restructure the Documentation page into the 1A overview-first hierarchy while
leaving writes and final visual polish for later phases.

## Work Items

- Replace the header rollup chips with the `Documentation status` header,
  subtitle, and computed attention line.
- Introduce local expansion state for sections, groups, and records.
- Render section cards collapsed by default, with hash-target expansion.
- Render group cards only inside expanded sections.
- Render compact record rows only inside expanded groups.
- Preserve the section-level "How to photograph" directions affordance in or
  near the redesigned section headers.
- Preserve existing filter behavior and empty-state behavior.
- Keep current read-only/write controls functional enough to avoid regressions
  while Phase 02 completes the select/drop-zone redesign.

## Acceptance

- The page no longer renders all records fully expanded on initial load.
- Section and group buttons expose correct `aria-expanded` state.
- The existing directions modal still opens from each applicable section.
- Existing Documentation tests are updated or extended for overview load and
  drill-down behavior.
