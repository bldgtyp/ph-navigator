---
DATE: 2026-06-24
TIME: 08:10 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Current status for the DataTable Status Field refactor packet.
RELATED: planning/archive/data-table-status-field/README.md, planning/archive/data-table-status-field/PLAN.md
---

# Status - DataTable Status Field

## Current State

State: **Complete** — all five phases done; packet ready to archive.

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
passed**). Phase 04 reset/reseeded the live local dev DB and smoked the mounted
app: the seeded project carries status options + values, the Thermal Bridges
Status column edits and persists across reload in-browser, and out-of-scope
tables show no Status column (full evidence in `phase-04`). Phase 05 closed out
the packet: durable contract folded into
`context/technical-requirements/data-table.md`, `graphify update .` rebuilt the
graph, and final `make ci` is green.

## Next Step

None required — the feature is implemented, verified, and documented. Phase 05
closed out: durable contract folded into
`context/technical-requirements/data-table.md`, `graphify update .` rebuilt the
graph, and **final `make ci` is green (backend 1061 passed/2 skipped; frontend
1887 passed; exit 0)**. Optional follow-ups left for Ed: (1) archive this packet
under `planning/archive/data-table-status-field/` and point `planning/STATUS.md`
at it; (2) seed the starter project under `codex@example.com` (or document Ed as
the seed owner) so future browser smokes match the `codex` guidance; (3) decide
whether existing/non-dev persisted documents need a status backfill (currently
scoped to new/seeded documents only).

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

Phase 04 (2026-06-24):

- `make db-reset-dev` + `make seed-agent-user` + `scripts.check_db`
  (`database ok`) succeeded on the live stack (Postgres :5433, MinIO :9000,
  backend :8000, Vite :5173).
- API smoke (as `ed@example.com`, the seed project owner): `status` FieldDef +
  `<table>.status` options + seeded row values present on pumps,
  thermal_bridges, heat_pumps_outdoor_equip, heat_pumps_indoor_equip;
  heat_pumps_outdoor_units (out of scope) has none.
- Browser: Thermal Bridges Status column renders the four seeded values;
  edit Complete→Question via the cell editor → PUT 200 → persisted after
  reload. Ventilators (out of scope) shows no Status column; HP
  Equipment-Outdoor renders via its parallel path.
- Coverage honesty: only Thermal Bridges was fully clicked-through in-browser;
  the other tables rely on the API smoke + automated suites + shared
  single-select parity (recorded in `phase-04`).

Phase 05 (2026-06-24):

- Durable status contract folded into
  `context/technical-requirements/data-table.md` § Backend Data Shapes.
- `graphify update .` rebuilt the graph (18096 nodes, 47148 edges).
- **Final `make ci` green (exit 0): backend 1061 passed / 2 skipped; frontend
  1887 passed (197 files).**
- All phase ledgers, README phase map, and this STATUS reflect actual state.
