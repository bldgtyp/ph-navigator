---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: In progress
AUTHOR: Ed (via Codex)
SCOPE: Planning packet for a focused DataTable regression test suite.
RELATED:
  - planning/features/data-table-regression-suite/PRD.md
  - planning/features/data-table-regression-suite/PLAN.md
  - planning/features/data-table-regression-suite/STATUS.md
  - context/technical-requirements/data-table.md
---

# DataTable Regression Suite - Feature Folder

## Scope

Design, then later implement, a focused regression suite for PH-Navigator's
shared project DataTables. The suite should prove that table rendering,
inline editing, select editing, linked-record editing, persistence, and
table-view state behave consistently across the app's core tabular
surfaces.

Phase 01 (inventory + harness skeleton) is implemented under
`frontend/tests/e2e/table-regression/`. Phases 02-06 (contract tests,
smoke matrix, behavior matrix, deep links/view state, run policy) remain
planned.

## Problem Frame

DataTables are core PH-Navigator infrastructure. The app now has many
domain-specific table surfaces backed by shared DataTable plumbing, but
small differences in field definitions, table keys, adapters, linked-record
targets, and route wrappers can produce inconsistent behavior. The test
strategy should make those inconsistencies visible early without forcing a
slow browser suite into every normal development loop.

## Target Tables

| Area | Table |
|---|---|
| Spaces | Space Types |
| Spaces | Rooms |
| Equipment | Ventilators |
| Equipment | Heat Pumps - Equipment Outdoor |
| Equipment | Heat Pumps - Equipment Indoor |
| Equipment | Heat Pumps - Units Outdoor |
| Equipment | Heat Pumps - Units Indoor |
| Equipment | Pumps |
| Equipment | Fans |
| Equipment | Hot Water Heaters |
| Equipment | Hot Water Tanks |
| Equipment | Electric Heaters |
| Equipment | Appliances |
| Assets | Thermal Bridges |

## Read Order

1. `STATUS.md` - current state, next step, open decisions.
2. `PRD.md` - behavior contract and acceptance criteria.
3. `PLAN.md` - implementation sequence and proposed test structure.
4. `phases/phase-00-planning-packet.md` - docs-only planning record.
5. Later active phase file under `phases/`, once implementation starts.

## Current Boundaries

- Implement one phase at a time, in order; keep later-phase code out of
  the current phase's scope.
- Do not change DataTable runtime behavior as part of this suite.
- Do not move the full browser matrix into default CI until it has been
  stabilized and reviewed.
- Keep durable DataTable interaction contracts in
  `context/technical-requirements/data-table.md` after implementation
  decisions are accepted.

