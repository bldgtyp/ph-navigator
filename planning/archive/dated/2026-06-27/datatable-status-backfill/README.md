---
DATE: 2026-06-27
TIME: 10:55 EDT
STATUS: Complete
AUTHOR: Claude
SCOPE: Resolved the deferred DataTable `status` backfill as unnecessary before first deploy because PHN has no users and no old project documents.
RELATED: planning/archive/dated/2026-06-27/datatable-status-backfill/PLAN.md, planning/archive/dated/2026-06-24/data-table-status-field/STATUS.md, planning/archive/dated/2026-06-24/data-table-status-field-addendum/STATUS.md, context/technical-requirements/data-table.md
---

# DataTable Status Field — Backfill of Existing Documents

## Why this exists

The built-in `status` single-select was added to DataTable records in two
passes — the original [data-table-status-field](../../2026-06-24/data-table-status-field/STATUS.md)
feature (9 tables) and the
[data-table-status-field-addendum](../../2026-06-24/data-table-status-field-addendum/STATUS.md)
(3 more: Ventilators + the two Heat-Pump Unit leaves, for 12 total). **Both
passes intentionally scoped the change to new/seeded documents plus the local
dev reset/reseed, and deferred any migration of pre-existing persisted
documents.** This folder is where that deferred decision lives so it is not
lost.

## The open question

A project document created **before** the status feature shipped will not carry,
for each of the 12 in-scope tables:

- the built-in `status` `FieldDef` in that table's `field_defs`;
- the namespaced `<table_label>.status` option list in
  `single_select_options`;
- any `custom_values.status` value on existing rows.

Today the UI/back end tolerate this (the field simply does not appear for those
documents). The question is whether those documents should be **upgraded** so the
Status column appears everywhere uniformly — which matters most once the
**splash-page status dashboard** (the downstream feature `status` was built to
feed) starts accounting for documentation completeness. A document missing the
field would either be invisible to that dashboard or need special-casing.

## Current relevance

PH-Navigator V2 is pre-deploy with no production users (see root `CLAUDE.md`
§Status), so the set of "pre-existing persisted documents" is currently small or
empty — every fresh project gets the field via `empty_project_document()`, and
the dev project gets it via reseed. **This is why it is Deferred, not Active:**
there is likely nothing to migrate yet. It becomes real if/when (a) long-lived
documents accumulate before the dashboard ships, or (b) a document predates this
work and must show Status.

Review on 2026-06-27 against the current code base did **not** find this
implemented elsewhere. `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` remains `1`,
the project-document read path validates bodies directly and falls back to
read-safe envelopes (`schema_validation_failed_after_migration`) on invalid
bodies, and there is no project-document upgrade chain or status-backfill script
under `backend/features/project_document/`, `backend/scripts/`, or Alembic.
Current tests cover the forward path (`test_starter_project_document_seeds_status_options_and_values`,
per-table status slice tests, and the `STATUS_TABLE_NAMES` drift guard), not a
historical-body migration. The existing `/projects/{id}/status` tab is the
separate project lifecycle tracker backed by `project_status_items`; it is not
the DataTable completeness dashboard this field was added to support.

Ed clarified on 2026-06-27 that there are **no users and no old projects to
update**; PHN is starting fresh. The feature is therefore complete as a
fresh-start/no-migration closeout, not a historical data migration. Verification
passed with the focused backend tests named in `PLAN.md`.

## Likely shape of the work (when picked up)

Documents are versioned JSONB with a `schema_version`. The natural mechanism is a
**document migration** that, for any document missing the field on an in-scope
table, injects:

1. `status_field_def()` into that table's `field_defs` (idempotent — skip if
   already present);
2. `status_option_list()` under `status_option_key(<table_label>)` in
   `single_select_options`;
3. optionally a default `custom_values.status` (`opt_status_needed`) on existing
   rows, or leave rows blank so they read as "not yet triaged".

Single source of truth for the table list and field shape is
`backend/features/project_document/tables/_status_field.py`
(`STATUS_TABLE_NAMES`, `status_field_def`, `status_option_list`,
`status_option_key`) — the migration must drive off that list so it stays in
sync with the 12 tables and the drift guard.

Decide explicitly: default existing rows to `Needed`, or leave them unset? (The
dashboard's "remaining work" accounting depends on this choice.)

## Decision owner

Ed answered the current product call on 2026-06-27: no historical project
documents exist, so no backfill is needed before first deploy.

## Files

- `README.md` — this file (scope + the deferred decision).
- `STATUS.md` — current state and the trigger that would reactivate it.
- `PLAN.md` — fresh-start/no-migration implementation and closeout plan.
