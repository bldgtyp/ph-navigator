---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Add default nullable unit-aware supply/extract airflow fields to Spaces /
  Rooms.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - context/technical-requirements/data-table.md
---

# Rooms Airflow Fields

## Scope

Add two default Rooms fields:

- `Supply airflow rate`
- `Extract airflow rate`

Both should be nullable unit-aware numeric fields with IP/SI display as
`cfm <> m3/h`, rendering blank when no value is present.

## Read Order

1. `PRD.md`
2. `PLAN.md`
3. `STATUS.md`

## Classification

`planning/features` because this adds default project data fields to the Spaces /
Rooms product contract.

