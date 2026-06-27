---
DATE: 2026-06-27
TIME: 10:10 EDT
STATUS: Deferred
AUTHOR: Claude
SCOPE: Current state of the deferred DataTable status-field backfill decision.
RELATED: planning/features/datatable-status-backfill/README.md
---

# Status — DataTable Status Field Backfill

## Current state

State: **Deferred / not implemented.** Current-code review on 2026-06-27 found
the packet is still accurate: both status-field implementation passes (original
9-table feature + the 3-table addendum, now 12 tables total) intentionally
scoped to new/seeded documents and left a backfill of pre-existing persisted
documents out of scope.

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

Conclusion: this is not "done"; it is still intentionally unnecessary until a
real historical project document or a DataTable completeness dashboard needs
pre-status documents to expose the field.

## Trigger to reactivate

Promote to **Active** when any of these becomes true:

- The splash-page **status dashboard** starts accounting for documentation
  completeness and must include documents that predate the status feature.
- A real (non-dev) project document exists that predates the field and must show
  the Status column.
- Ed decides historical documents should be upgraded proactively.

Until then there is likely nothing to migrate (V2 is pre-deploy; fresh projects
already get the field).

## Next step

None — awaiting Ed's product call or a concrete historical document. If picked
up: write an idempotent document migration driven off `STATUS_TABLE_NAMES` /
`status_field_def` / `status_option_list`, decide whether pre-existing rows
default to `opt_status_needed` or stay unset, and add tests that build a legacy
body missing the status FieldDefs / option lists before proving the migration.

## Open questions

1. Do historical documents need the field, or is new-documents-only acceptable
   long-term?
2. If backfilled, should existing rows default to `Needed`, or remain blank
   (un-triaged) so the dashboard does not overstate remaining work?
