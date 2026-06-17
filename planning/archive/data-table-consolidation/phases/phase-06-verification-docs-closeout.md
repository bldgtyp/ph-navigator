---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Complete - full CI/browser smoke green
AUTHOR: Ed (via Claude)
SCOPE: Final gates, browser smoke across every table, graph refresh, and
  folding durable decisions into context docs.
RELATED:
  - planning/archive/data-table-consolidation/PRD.md
  - planning/archive/data-table-consolidation/PLAN.md
  - context/technical-requirements/data-table.md
  - context/CODING_STANDARDS.md
---

# Phase 06 - Verification, Docs, And Closeout

## Goal

Prove the consolidation holds end-to-end and capture the durable rules so
future table work stays consistent.

## Preconditions

- The phases the owner chose to ship are complete and individually
  verified.

## Tasks

1. [x] Run the mandatory closeout gate from the repo root:
   - `make format`
   - `make ci`
   - If `make format` changes files, inspect the diff and rerun
     `make ci`.
2. [x] Browser smoke on `http://localhost:5173` (backend
   `http://localhost:8000`, signed in as `codex@example.com`):
   walk Rooms, each Equipment tab, each Heat-Pump leaf, and Thermal
   Bridges. Confirm single-select pills, link/linked-record pills,
   attachment cells, identifier columns, and row-edit modals look and
   behave identically across all of them.
3. [x] Run `graphify update .` to refresh the knowledge graph after the code
   changes.
4. [x] Fold durable decisions into context docs:
   - `context/technical-requirements/data-table.md`: the canonical
     table-page recipe (controller + shell + shared cells), the single
     identifier-uniqueness rule, and the converged data-shape decisions
     (`inside_outside`, `phase`).
   - `context/CODING_STANDARDS.md`: "render every field type through its
     shared cell; do not re-implement single-select / link / attachment /
     identifier columns per table" as an explicit rule, with the shared
     helper names.
5. [x] Update this folder's `STATUS.md`, extract follow-up cleanup into
   `planning/features/data-table-maintenance/`, and move the completed
   packet to `planning/archive/` per `planning/.instructions.md`.
6. [x] Confirm the 2026-06-16 review's findings are each either resolved or
   explicitly carried forward with a reason.

## Acceptance Criteria

- `make format` and `make ci` are green.
- Browser smoke confirms rendering/behavior parity across all tables.
- `graphify update .` has been run.
- `data-table.md` and `CODING_STANDARDS.md` capture the canonical recipe,
  the identifier-uniqueness rule, and the data-shape decisions.
- `STATUS.md` reflects final state; follow-up items are recorded outside
  this archive.

## Stop Conditions

- Stop if `make ci` is red; fix locally and rerun before declaring
  closeout, per the mandatory closeout gate.
- Do not archive the packet while any shipped phase is unverified or any
  review finding is silently dropped.

## File Entry Points

- `context/technical-requirements/data-table.md`
- `context/CODING_STANDARDS.md`
- `planning/archive/data-table-consolidation/STATUS.md`
- `Makefile`

## Implementation Notes

- `make format` passed.
- `make ci` passed on 2026-06-17:
  - backend: 898 passed, 2 skipped, 1 warning;
  - frontend: 174 test files passed, 1674 tests passed;
  - production build passed with existing Vite chunk-size warnings.
- Browser smoke passed on `http://localhost:5173` with backend
  `http://localhost:8000`, signed in as `codex@example.com`, on:
  - `/spaces/rooms`;
  - `/equipment?tab=ventilators`;
  - `/equipment?tab=pumps`;
  - `/equipment?tab=fans`;
  - `/equipment?tab=hot-water-heaters`;
  - `/equipment?tab=hot-water-tanks`;
  - `/equipment?tab=electric-heaters`;
  - `/equipment?tab=appliances`;
  - `/equipment/heat-pumps/equipment-outdoor`;
  - `/equipment/heat-pumps/equipment-indoor`;
  - `/equipment/heat-pumps/units-outdoor`;
  - `/equipment/heat-pumps/units-indoor`;
  - `/thermal-bridges`.
- Browser smoke caught and this phase fixed Heat Pump linked-record
  schema drift: unit built-in link fields now declare backend
  `linked_record` FieldDefs, and synthetic Heat Pump computed columns
  append frontend-only FieldDefs when they need shared renderers.
- `graphify update .` passed after code changes.
- Durable docs updated:
  - `context/technical-requirements/data-table.md`;
  - `context/CODING_STANDARDS.md`.
- Review finding status:
  - Backend validation and asset/option reference hardening: resolved in
    Phase 01 and covered by CI.
  - Shared cell/helper adoption: resolved across generic equipment,
    Rooms, Ventilators, Thermal Bridges, and Heat Pump leaves.
  - Identifier uniqueness: resolved by the record-identity refactor and
    recorded in context docs.
  - Heat Pump shared abstraction/custom-field gap: resolved by Phase 05;
    browser smoke verified rendered server schemas on live routes.

## Follow-Up

Non-blocking cleanup items were moved to
`planning/features/data-table-maintenance/`.
