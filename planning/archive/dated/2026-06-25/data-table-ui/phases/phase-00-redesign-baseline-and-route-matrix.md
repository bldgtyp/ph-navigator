---
DATE: 2026-06-25
TIME: 00:57 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Baseline capture and DataTable surface inventory before UI changes.
RELATED:
  - planning/archive/dated/2026-06-25/data-table-ui/PLAN.md
  - planning/archive/dated/2026-06-25/data-table-ui/reviews/table-redesign-review.md
  - planning/archive/dated/2026-06-25/data-table-ui/ROUTE_MATRIX.md
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

- Complete: the route matrix is recorded in
  `planning/archive/dated/2026-06-25/data-table-ui/ROUTE_MATRIX.md`.
- Complete: a written baseline checklist exists in
  `planning/archive/dated/2026-06-25/data-table-ui/ROUTE_MATRIX.md`; screenshots were
  deliberately deferred to later browser review.
- Complete: implementation phases can verify against the representative
  browser route set in `ROUTE_MATRIX.md`.

## Verification

- `graphify query "DataTable consumers and routes for data-table-ui route matrix"`
- `rg -n "<DataTable|DataTable\\(" frontend/src --glob '*.{tsx,ts}'`
- Targeted source reads of route owners and DataTable consumer props.
