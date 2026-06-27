---
DATE: 2026-06-27
TIME: 10:55 EDT
STATUS: Complete
AUTHOR: Claude
SCOPE: Closeout state for the DataTable status-field backfill decision.
RELATED: planning/archive/dated/2026-06-27/datatable-status-backfill/README.md, planning/archive/dated/2026-06-27/datatable-status-backfill/PLAN.md
---

# Status — DataTable Status Field Backfill

## Current state

State: **Complete / resolved-unneeded.** Current-code review on 2026-06-27
confirmed both status-field implementation passes (original 9-table feature +
the 3-table addendum, now 12 tables total) intentionally scoped to new/seeded
documents and left a backfill of pre-existing persisted documents out of scope.
Ed clarified the missing premise: PHN has no users and no old project documents
to update, so there is no historical data to migrate before first deploy.

Evidence from the current code base:

- `backend/features/project_document/tables/_status_field.py` still owns the
  12-table `STATUS_TABLE_NAMES` registry and shared FieldDef / option-list
  helpers.
- `backend/features/project_document/templates.py` still seeds
  `<table>.status` option lists for fresh documents from `STATUS_TABLE_NAMES`.
- `backend/features/project_document/document.py` still has
  `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 1`; there is no version bump for a
  status backfill.
- `backend/features/project_document/store.py` validates stored bodies directly
  and only returns a read-safe envelope on invalid bodies; it does not upgrade
  documents on read.
- No status-backfill script or Alembic migration exists under
  `backend/scripts/` or `backend/alembic/versions/`.
- The active `/projects/{id}/status` feature is the separate
  `project_status_items` lifecycle tracker, not a DataTable completeness
  dashboard.

Conclusion: no product/code work remains for this packet. The correct
implementation was to keep the fresh-start status-field contract and skip a
schema bump, read-time migration, Alembic data migration, and one-off backfill
script.

## Verification

Passed on 2026-06-27:

- `uv run pytest tests/test_seed_dev_db.py::test_starter_project_document_seeds_status_options_and_values tests/test_seed_dev_db.py::test_status_table_names_match_registered_contracts tests/test_project_document_default_option_fill.py::test_existing_row_not_backfilled_when_default_now_set`
- `rg -n "CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION|read_safe|status-backfill|STATUS_TABLE_NAMES" features/project_document tests scripts alembic/versions`

## Next step

Archived under `planning/archive/dated/2026-06-27/datatable-status-backfill/`.

## Reopen rule

Reopen only if PHN later imports or preserves real project documents that
predate the built-in `status` field. At that point, write a real migration plan
and decide whether pre-existing rows default to `opt_status_needed` or stay
unset.
