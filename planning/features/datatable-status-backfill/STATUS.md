---
DATE: 2026-06-24
TIME: 12:00 EDT
STATUS: Deferred
AUTHOR: Claude
SCOPE: Current state of the deferred DataTable status-field backfill decision.
RELATED: planning/features/datatable-status-backfill/README.md
---

# Status — DataTable Status Field Backfill

## Current state

State: **Deferred.** Both status-field implementation passes (original 9-table
feature + the 3-table addendum, now 12 tables total) intentionally scoped to
new/seeded documents and left a backfill of pre-existing persisted documents out
of scope. No migration exists. Pulled out of the addendum packet so the thread is
not lost when that packet is archived.

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

None — awaiting Ed's product call (see `README.md` § Decision owner). If picked
up: write a document migration driven off `STATUS_TABLE_NAMES` /
`status_field_def` / `status_option_list`, and decide whether pre-existing rows
default to `opt_status_needed` or stay unset.

## Open questions

1. Do historical documents need the field, or is new-documents-only acceptable
   long-term?
2. If backfilled, should existing rows default to `Needed`, or remain blank
   (un-triaged) so the dashboard does not overstate remaining work?
