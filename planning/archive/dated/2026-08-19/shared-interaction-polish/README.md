---
DATE: 2026-08-19
TIME: 20:47 EDT
STATUS: Complete — implemented, verified, and archived
AUTHOR: Ed May / Codex
SCOPE: Shared SegmentedControl affordance and expandable ReportTable seams
RELATED:
  - planning/archive/dated/2026-08-19/shared-interaction-polish/PRD.md
  - planning/archive/dated/2026-08-19/shared-interaction-polish/STATUS.md
  - context/DESIGN_SYSTEM.md
  - planning/2026-08-19-ui-batch.md
---

# Shared Interaction Polish

Two app-wide visual defects belong at the shared-component layer:

1. Small equal-width `SegmentedControl` options do not advertise clickability
   strongly enough and lack delayed explanatory tooltips.
2. A reported expanded `ReportTable` row shows an accent-border/background
   notch in Envelope → Materials despite existing shared seam rules; reproduce
   and isolate it before deciding whether shared CSS still needs a change.

Fixing either in feature-local CSS would leave the same primitive inconsistent
elsewhere. This packet changes the shared components and verifies representative
consumers.

## Read order

1. `PRD.md` — component contracts and regression matrix.
2. `STATUS.md` — next step and verification ledger.

## Current-code anchors

- `frontend/src/shared/ui/SegmentedControl.tsx`
- `frontend/src/shared/ui/SegmentedControl.css`
- `frontend/src/shared/ui/tooltip/`
- `frontend/src/shared/ui/report-table/ReportTable.tsx`
- `frontend/src/shared/ui/report-table/ReportTable.css`
- `frontend/scripts/interaction-states-baseline.json`
