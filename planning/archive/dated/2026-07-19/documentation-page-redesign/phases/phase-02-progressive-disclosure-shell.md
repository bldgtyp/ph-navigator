---
DATE: 2026-07-19
TIME: 00:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Build the Option 1A section/group/record shell over the existing summary data.
RELATED:
  - planning/archive/dated/2026-07-19/documentation-page-redesign/PLAN.md
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

## Implementation Notes

- `DocumentationSummaryView` now owns local expansion state for sections,
  groups, and records.
- Hash targets expand their containing section and, for group anchors, the
  matching group before scrolling.
- The page header renders `Documentation status`, a short subtitle, and a
  computed attention line from summary counts.
- Section and group rows show rollups while their bodies remain collapsed until
  opened.
- `DocumentationRecordRow` now renders a compact summary row plus an expanded
  panel for owner links, detail modal access, and existing evidence controls.
- `DocumentationModals` holds the preserved directions and record detail modal
  views so row rendering remains below the repository size threshold.
- Simplify review fixes included section-scoped group body ids, distinct
  Datasheet/Photos waiver accessible names, inherited group-title font styling,
  and stronger filter/viewer assertions.

## Verification

- `pnpm exec vitest run src/features/documentation/__tests__/DocumentationSummaryView.test.tsx` passed.
- `pnpm exec tsc -b --pretty false` passed.
- `make frontend-dev-check` passed; eslint still reports pre-existing Fast
  Refresh warnings in unrelated files.
