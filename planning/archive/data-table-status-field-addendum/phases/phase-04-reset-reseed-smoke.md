---
DATE: 2026-06-24
TIME: 11:00 EDT
STATUS: Done
AUTHOR: Claude
SCOPE: Phase 04 — local DB reset/reseed and browser smoke of the three new tables.
RELATED: planning/archive/data-table-status-field-addendum/PLAN.md
---

# Phase 04 — Local Reset, Reseed, and Smoke

## Goal

The live local stack shows the seeded `Status` values on the three new tables and
in-browser edits persist across reload, with the originally-covered tables
unchanged.

## Steps

1. Focused checks first:
   - `cd backend && uv run pytest backend/tests/test_project_document_ventilators.py backend/tests/features/heat_pumps/test_heat_pumps.py backend/tests/test_seed_dev_db.py`
   - `cd frontend && pnpm exec vitest run` for the three table tests.
2. Repo dev checks: `make check-backend`, `make frontend-dev-check`.
3. Reset/reseed the local dev DB (repo pipeline only — no manual SQL):
   - `make db-reset-dev`
   - `make seed-agent-user`
   - `cd backend && uv run python -m scripts.check_db` (expect `database ok`).
4. API smoke (as `ed@example.com`, the seed project owner): confirm the `status`
   FieldDef + `<table>.status` options + seeded row values are present on
   `ventilators`, `heat_pumps_outdoor_units`, `heat_pumps_indoor_units`.
5. Browser smoke at `http://localhost:5173`, **signed in as `ed@example.com`**
   (see memory: the dev seed project is owned by Ed, not codex; single active
   session per user):
   - Open Ventilators, Heat-Pump Outdoor Units, Heat-Pump Indoor Units.
   - Confirm `Status` renders as a single-select column with the four seeded
     values painted in the report-status palette.
   - On each table, edit one row through a status transition (e.g.
     Needed → Complete) via the cell editor → expect PUT 200 → reload → confirm
     persistence.
   - Confirm a Heat-Pump Unit's linked-field / aggregate behavior is unchanged
     after the status edit.
   - Spot-check that an out-of-scope table (e.g. Rooms) still shows no Status
     column.

## Coverage honesty

Record which tables were fully clicked-through in-browser vs. covered by API smoke
+ automated suites + shared single-select parity, mirroring the original Phase-04
evidence discipline.

## Verification / evidence to record

- Reset/reseed commands and `database ok`.
- API smoke results per table.
- Browser PUT 200 + post-reload persistence per table; screenshots to
  `assets/` if useful.

## Done when

The three tables visibly carry and edit `Status` on the live stack with persisted
edits, and no regression is observed on the original tables.
