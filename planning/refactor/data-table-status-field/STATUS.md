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

State: Active / Phases 01-02 complete; Phases 03-05 pending.

Phase 01 (contract + seeds) and Phase 02 (backend validation + tests) are
implemented. Phase 01 added the shared `tables/_status_field.py` helper,
`status_field_def()` on the nine in-scope FieldDef tuples, seeded
`<table>.status` option lists + row values, and a `STATUS_TABLE_NAMES` drift
guard. Phase 02 wired each table's slice `single_select_options` contract to
accept/persist/emit its `<table_label>.status` key (via new
`*_STATUS_OPTION_KEY` constants in `document.py` + `status` fields on the
`*SliceOptions` models + Heat Pump leaf options), added `tests/
status_field_helpers.py` and per-table status tests, and **`make check-backend`
is green (1061 passed, 2 skipped)**. Frontend (Phase 03), DB reset/reseed +
browser smoke (Phase 04), and closeout (Phase 05) are not started.

## Next Step

Start `phases/phase-03-frontend-types-ui.md`: expose the backend `status`
FieldDef as an editable DataTable single-select column — update the frontend
option-map types so the namespaced `*.status` keys type-check, carry
`fieldDefaults.status` into new-row `custom_values`, and reuse the shared
`SingleSelectCell` (with an optional Materials-style color cue), with focused
frontend tests.

## Open Questions

- Should existing non-dev persisted documents be backfilled, or is this intentionally scoped to new documents plus local dev reset/reseed?
- Should the `Status` single-select cell render with Materials-style status dots immediately, or is the generic single-select pill acceptable until the splash dashboard is built?

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

Deferred to later phases: frontend types/UI (Phase 03), DB reset/reseed +
browser smoke (Phase 04), graph/docs closeout (Phase 05).
