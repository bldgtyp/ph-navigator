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

State: Active / Phase 01 (Contract And Seeds) complete; Phases 02-05 pending.

Phase 01 is implemented and committed: shared `tables/_status_field.py` helper,
`status_field_def()` appended to the nine in-scope built-in FieldDef tuples,
`<table>.status` option lists seeded into `empty_project_document()` and all
eight equipment/thermal-bridge seed JSONs (rows exercise all four statuses), and
a `STATUS_TABLE_NAMES` drift guard in `tables/registry.py`. The empty and full
seed-assembled documents both pass `validate_document()`, and unknown status ids
are rejected through the existing single-select path. Backend option-model and
test wiring (Phase 02) has not been started; no DB reset/reseed yet (Phase 04).

## Next Step

Start `phases/phase-02-backend-validation-tests.md`: wire each in-scope table's
`single_select_options` contract to accept/emit its `*.status` key (shared
equipment slice option models + Heat Pump leaf option exposure), then add the
backend table/validator/seed tests, including a guard that `STATUS_TABLE_NAMES`
stays in sync with the registered contracts.

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

Deferred to later phases: backend slice-option-model wiring + pytest coverage
(Phase 02), frontend types/UI (Phase 03), DB reset/reseed + browser smoke
(Phase 04), graph/docs closeout (Phase 05).
