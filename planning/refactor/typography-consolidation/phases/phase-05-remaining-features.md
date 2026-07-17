---
DATE: 2026-07-17
TIME: afternoon ET
STATUS: Not started
AUTHOR: Codex
SCOPE: Model viewer, climate, project status/version controls, admin, tooltip,
  overlay, chart props, and all remaining source debt
DEPENDS_ON: Phase 4
RELATED:
  - `../PRD.md`
  - `../TYPOGRAPHY-CONTRACT.md`
---

# Phase 5 — Remaining feature owners and zero source debt

## Goal

Finish the owner-by-owner migration, including selectors not reached by the
baseline browser sweep, and reduce the static debt baseline to empty.

## Primary owners

- `frontend/src/features/model_viewer/model_viewer.css`
- `frontend/src/features/climate/*.css`
- `frontend/src/features/project_status/*.css`
- `frontend/src/features/project_document/version-controls.css`
- `frontend/src/features/admin/admin.css`
- remaining shared tooltip/overlay CSS
- TS/TSX inline or library typography props identified by the Phase 1 scanner

## Build

1. Migrate each remaining owner as a complete unit. Model viewer is its own
   commit inside the phase because of its large stylesheet and canvas-adjacent
   surface.
2. Normalize empty-state headings, status groups/badges, climate metadata,
   chart legends/axes, model annotations, project version chrome, and admin UI.
3. Route unavoidable Recharts/SVG typography props through named tokens and
   documented adapter exceptions. Ordinary UI must move to CSS roles.
4. Remove all resolved baseline fingerprints and run the scanner across the
   full source tree.
5. Delete the migration baseline file if the guard supports zero-debt without
   it; otherwise keep an explicitly empty baseline with a schema assertion.

## Verification

- Full static scan has zero debt and only approved technical exceptions.
- Focused computed audit: model, climate, status, admin, and any new state
  added for dormant owner coverage.
- Screenshots: model empty/populated states, climate cards/charts, roadmap and
  status modal, version controls, and admin table/modal.
- Role targets from the PRD hold for headings, buttons, badges, nav, labels,
  and body text before the final evaluator phase.
- `make frontend-dev-check` during iteration; `make format` and `make ci` at
  phase closeout.

## Done when

The source-debt baseline is empty, the guard is operating in native zero-debt
mode, and all exceptions are token-backed technical boundaries.
