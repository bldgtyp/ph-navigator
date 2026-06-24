---
DATE: 2026-06-24
TIME: 12:00 EDT
STATUS: Deferred
AUTHOR: Claude
SCOPE: Decide whether (and how) to backfill the built-in DataTable `status` field onto pre-existing persisted project documents that predate the status feature, across all 12 status-bearing tables.
RELATED: planning/archive/dated/2026-06-24/data-table-status-field/STATUS.md, planning/archive/dated/2026-06-24/data-table-status-field-addendum/STATUS.md, context/technical-requirements/data-table.md
---

# DataTable Status Field — Backfill of Existing Documents

## Why this exists

The built-in `status` single-select was added to DataTable records in two
passes — the original [data-table-status-field](../../archive/dated/2026-06-24/data-table-status-field/STATUS.md)
feature (9 tables) and the
[data-table-status-field-addendum](../../archive/dated/2026-06-24/data-table-status-field-addendum/STATUS.md)
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

Ed — this is a product call (does the dashboard need historical documents
upgraded, and what should pre-existing rows default to). No code is needed until
that call is made; this folder just preserves the thread.

## Files

- `README.md` — this file (scope + the deferred decision).
- `STATUS.md` — current state and the trigger that would reactivate it.
