---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: Final gates, browser smoke across every table, graph refresh, and
  folding durable decisions into context docs.
RELATED:
  - planning/refactor/data-table-consolidation/PRD.md
  - planning/refactor/data-table-consolidation/PLAN.md
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

1. Run the mandatory closeout gate from the repo root:
   - `make format`
   - `make ci`
   - If `make format` changes files, inspect the diff and rerun
     `make ci`.
2. Browser smoke on `http://localhost:5173` (backend
   `http://localhost:8000`, signed in as `codex@example.com`):
   walk Rooms, each Equipment tab, each Heat-Pump leaf, and Thermal
   Bridges. Confirm single-select pills, link/linked-record pills,
   attachment cells, identifier columns, and row-edit modals look and
   behave identically across all of them.
3. Run `graphify update .` to refresh the knowledge graph after the code
   changes.
4. Fold durable decisions into context docs:
   - `context/technical-requirements/data-table.md`: the canonical
     table-page recipe (controller + shell + shared cells), the single
     identifier-uniqueness rule, and the converged data-shape decisions
     (`inside_outside`, `phase`).
   - `context/CODING_STANDARDS.md`: "render every field type through its
     shared cell; do not re-implement single-select / link / attachment /
     identifier columns per table" as an explicit rule, with the shared
     helper names.
5. Update this folder's `STATUS.md` to reflect shipped vs deferred phases,
   and move the packet (or the completed phases) toward
   `planning/archive/` per `planning/.instructions.md` once the work is
   merged. Note any deferred items (e.g. a documented heat-pump
   custom-field gap) so they remain discoverable.
6. Confirm the 2026-06-16 review's findings are each either resolved or
   explicitly carried forward with a reason.

## Acceptance Criteria

- `make format` and `make ci` are green.
- Browser smoke confirms rendering/behavior parity across all tables.
- `graphify update .` has been run.
- `data-table.md` and `CODING_STANDARDS.md` capture the canonical recipe,
  the identifier-uniqueness rule, and the data-shape decisions.
- `STATUS.md` reflects final state; deferred items are recorded.

## Stop Conditions

- Stop if `make ci` is red; fix locally and rerun before declaring
  closeout, per the mandatory closeout gate.
- Do not archive the packet while any shipped phase is unverified or any
  review finding is silently dropped.

## File Entry Points

- `context/technical-requirements/data-table.md`
- `context/CODING_STANDARDS.md`
- `planning/refactor/data-table-consolidation/STATUS.md`
- `Makefile`
