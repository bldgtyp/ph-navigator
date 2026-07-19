# Project Document Schema Versions

Running log of `ProjectDocumentV1.schema_version` bumps.

**Migration policy (production).** Document-body schema changes are
**forward-only, applied at read time**. Every saved/draft body carries an
integer `schema_version`; when a body older than the app's
`CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` is read, the upgrader
(`backend/features/project_document/migrations/upgrade.py`, `UPGRADE_STEPS`)
walks it dict-to-dict up to current and the result is persisted back on write
(`repository.py` rewrites the stale cache row). Bodies written by a *newer*
schema than the running app are rejected (`SchemaVersionTooNewError`), never
downgraded. There is a real shim chain — one step per version — so old
documents keep upgrading cleanly; this is not a one-shot reshape.

**Source of truth is the code**, not this table: the current version is
`CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` in
`backend/features/project_document/document.py`, and each step's exact behavior
is its `_upgrade_vN_to_vN+1` function in `migrations/upgrade.py`. Keep this log
in sync when you add a step.

| Version | Date | Change |
|---------|------|--------|
| 1 | — | Initial shape. Pre-beta baseline (`_upgrade_v0_to_v1` just stamps a v1-shaped body that lacked the stamp). `tables.<name>` is `Row[]`. |
| 2 | 2026-05-24 | Adds `{custom_fields, rows}` envelope to custom-field-capable tables and sparse `custom` on rows; `_upgrade_v1_to_v2` adds the Rooms supply/extract airflow built-ins without changing row values. |
| 3 | — | `_upgrade_v2_to_v3`: adds downstream-consumer built-in fields and new equipment option namespaces. |
| 4 | — | `_upgrade_v3_to_v4`: adds the built-in Room→Ventilator linked-record field. |
| 5 | — | `_upgrade_v4_to_v5`: adds the Heat Pump `name` ("Display Name") built-in and backfills it from the existing `tag`. |
| 6 | — | `_upgrade_v5_to_v6`: adds Documentation evidence (photo) fields/waivers and renames the built-in `status` field to "Specification Status". |

<!-- Backfill the missing dates from the plan/commit that landed each step when convenient; the code is authoritative in the meantime. -->
