---
DATE: 2026-06-24
TIME: 08:10 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Current status for the DataTable Status Field refactor packet.
RELATED: planning/refactor/data-table-status-field/README.md, planning/refactor/data-table-status-field/PLAN.md
---

# Status - DataTable Status Field

## Current State

State: Active / Phases 01-03 complete; Phases 04-05 pending.

Backend (Phases 01-02) and frontend (Phase 03) are implemented and green.
Phase 01 added the shared `tables/_status_field.py` helper + seeds + a
`STATUS_TABLE_NAMES` drift guard. Phase 02 wired each table's slice
`single_select_options` to accept/persist/emit its `<table_label>.status` key,
with `tests/status_field_helpers.py` and per-table status tests
(**`make check-backend` green: 1061 passed**). Phase 03 exposed `status` as an
editable DataTable single-select column on all nine tables — shared tables
resolve it through `useTableSchema` + `lib/statusColumn.ts`; the two heat-pump
equip leaves use a parallel `heat-pumps/status-column.ts` + a `status →
setCustomValue` cell-write seam. New rows default to `opt_status_needed`;
duplicate preserves status (**`make frontend-dev-check` green; vitest 1887
passed**). Remaining: DB reset/reseed + browser smoke (Phase 04) and closeout
(Phase 05).

## Next Step

Start `phases/phase-04-reset-reseed-smoke.md`: reset/reseed the local dev DB
(`make db-reset-dev` → `make seed-agent-user` → `scripts.check_db`), then smoke
the mounted app at `http://localhost:5173` (signed in as `codex@example.com`) —
confirm the `Status` column appears, edits persist across reload on at least
one shared table + both heat-pump equip leaves, and out-of-scope tables (Units,
Ventilators) show no Status column. **Phase 04 needs a running stack
(Docker/Postgres + Vite/FastAPI) and is the human-in-the-loop checkpoint** —
the object-store-backed `make db-reset-dev` also requires the climate bundle /
R2 prerequisites; if those block locally, record the exact blocker here.

## Open Questions

- Should existing non-dev persisted documents be backfilled, or is this intentionally scoped to new documents plus local dev reset/reseed? (Still open; scoped to new/seeded documents for now — no migration/backfill added.)
- ~~Should the `Status` cell render with Materials-style status dots immediately, or is the generic single-select pill acceptable until the splash dashboard?~~ **Resolved (Phase 03):** the generic single-select pill is used; its four option colors already are the Materials/report-status palette, so no bespoke dot renderer was added.

## Verification

Phase 01 (2026-06-24):

- `uv run ruff format` / `ruff check` clean on the touched table modules,
  `templates.py`, `registry.py`, and `scripts/seed_dev_db.py`.
- `empty_project_document()` builds with `status` FieldDefs on all nine
  in-scope tables and `<table>.status` option lists for each.
- The full seed-assembled starter document (`_starter_project_document`)
  passes `validate_document()`; seeded rows exercise all four statuses across
  the target tables.
- An unknown `status` option id is rejected via the existing single-select
  `coerce_custom_value` path (error: "single_select value ... is not a known
  option id"), confirming the `<table_label>.status` option-key wiring.

Phase 02 (2026-06-24):

- `make check-backend` green: **1061 passed, 2 skipped** (2 pre-existing
  deprecation warnings, unrelated).
- Every in-scope table slice round-trips `<table_label>.status` (GET exposes
  the FieldDef + options; PUT persists `custom_values.status`; unknown ids 422).
- Drift-guard test asserts `STATUS_TABLE_NAMES` == the registry contracts that
  carry the status FieldDef.

Phase 03 (2026-06-24):

- `make frontend-dev-check` green (format/lint/check:all/tsc/build); full
  `pnpm exec vitest run` = **1887 passed (197 files)**.
- Status renders as an editable single-select column on all nine tables via
  shared DataTable machinery; new rows default to Needed; duplicate preserves
  status; the column flows through filter/sort/group/CSV/row-detail.
- Simplify pass deduped a local `readStatusDefault` into the shared
  `shared/lib/fieldDefaults.ts`; all checks remained green.

Deferred to later phases: DB reset/reseed + browser smoke (Phase 04), graph/docs
closeout (Phase 05).
