---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: Docs-only creation of the DataTable regression suite plan.
RELATED:
  - planning/features/data-table-regression-suite/README.md
  - planning/features/data-table-regression-suite/PRD.md
  - planning/features/data-table-regression-suite/PLAN.md
  - planning/features/data-table-regression-suite/STATUS.md
---

# Phase 00 - Planning Packet

## Goal

Record a careful, implementation-ready plan for validating DataTable
rendering and behavior across the app, without implementing tests yet.

## Work Completed

- [x] Recorded all 14 target table surfaces.
- [x] Recorded the core field behaviors to validate:
  text, number, single-select, linked-record, persistence, and reload.
- [x] Recorded the proposed test layering:
  shared contract tests, route smoke matrix, behavior matrix, deep
  linked-record flows, and table-view-state checks.
- [x] Recorded the run policy distinction between normal frontend checks,
  focused table work, and final closeout.
- [x] Recorded implementation phases for later work.

## Explicit Non-Work

- [x] No frontend code was changed.
- [x] No backend code was changed.
- [x] No e2e or Vitest files were changed.
- [x] No package scripts were added.
- [x] No CI policy was changed.

## Completion Criteria

This phase is complete when the planning packet exists and
`planning/STATUS.md` routes future agents to it.

