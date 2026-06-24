---
DATE: 2026-06-24
TIME: 11:00 EDT
STATUS: Done
AUTHOR: Claude
SCOPE: Phase 02 — backend validation, per-table round-trip tests, and drift-guard expansion.
RELATED: planning/archive/data-table-status-field-addendum/PLAN.md
---

# Phase 02 — Backend Validation and Tests

## Goal

Prove the backend reads, writes, validates, and seed-assembles the `status` field
for the three new tables, and that the `STATUS_TABLE_NAMES` drift guard now
asserts the full 12-table set.

## Steps

1. Confirm each new table's slice option model accepts/persists/emits its
   `<table>.status` key:
   - GET exposes the `status` FieldDef and the `<table>.status` option list.
   - PUT persists `custom_values.status`.
   - An unknown option id returns HTTP 422 via the single-select validator.
2. Add or extend tests:
   - `backend/tests/test_project_document_ventilators.py` (create if absent;
     follow `test_project_document_pumps.py`) — status FieldDef present, options
     round-trip, value persists, unknown id 422, and `inside_outside` still works.
   - `backend/tests/features/heat_pumps/test_heat_pumps.py` — extend the outdoor-
     and indoor-**units** cases to assert the status FieldDef/options/persistence
     and 422 behavior, mirroring the existing equip-leaf assertions.
   - `backend/tests/test_seed_dev_db.py` — assert the assembled starter document
     validates with the three new `<table>.status` option lists and that seeded
     unit/ventilator rows carry `custom_values.status`.
3. **Update the drift-guard test** to expect `STATUS_TABLE_NAMES` == the 12
   registry contracts that carry the status FieldDef. It must go green only once
   all three tables are wired in Phase 01 — this is the structural enforcement
   that "Datasheet ⇒ status" can't silently regress.
4. Verify the heat-pump aggregate / linked-field response paths are unaffected by
   the unit-leaf status addition (the equip leaves already prove coexistence; add
   a focused assertion if the units' linked-field response is exercised in tests).

## Verification

- `make check-backend` green (expect the prior baseline of 1061 passed plus the
  new assertions).
- Each new table slice round-trips `<table>.status` (GET options + FieldDef; PUT
  persistence; unknown id 422).
- Drift-guard test asserts the 12-table set and is green.

## Done when

`make check-backend` is green with the new per-table and drift-guard coverage, and
unknown status ids are rejected on all three tables.
