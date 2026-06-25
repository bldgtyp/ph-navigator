---
DATE: 2026-06-24
TIME: 21:22 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Baseline capture and DataTable surface inventory before UI changes.
RELATED:
  - planning/features/data-table-ui/PLAN.md
  - planning/features/data-table-ui/reviews/table-redesign-review.md
  - frontend/src/shared/ui/data-table/DataTable.tsx
---

# Phase 00 - Redesign Baseline And Route Matrix

## Goals

- Establish the representative "all DataTables" verification set before
  changing shared CSS.
- Capture current visual behavior for high-risk surfaces.
- Identify table-local custom renderers that may need extra QA.

## Tasks

- Inventory every production `<DataTable>` consumer.
- Mark which consumers use attachments, linked records, status fields,
  number-with-units fields, custom `footerAction`, `onRowOpen`,
  row context actions, and heat-pump leaf adapters.
- Capture baseline screenshots for desktop-width representative routes.
- Decide whether global search is part of the first implementation or a
  follow-up behavior feature.

## Acceptance

- The route matrix is recorded in this feature folder.
- Baseline screenshots or a written baseline checklist exists for the
  representative tables.
- Implementation phases can verify against the same route list.
