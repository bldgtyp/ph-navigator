---
DATE: 2026-07-19
TIME: 14:30 EDT
STATUS: Research complete
AUTHOR: Codex
SCOPE: Current-code inventory and risk analysis for status-value unification.
RELATED:
  - ./decisions.md
  - ./PLAN.md
  - ../../../context/technical-requirements/save-versioning.md
---

# Research

## Persistence behavior

- Current checkout declares schema v7 in
  `backend/features/project_document/document.py`.
- `migrations/upgrade.py` contains sequential pure dict steps through
  `_upgrade_v6_to_v7`.
- Typed saved-version reads upgrade in memory. Raw download returns stored raw
  bytes.
- Stale drafts are rewritten on read by `store.rewrite_draft_if_upgraded`,
  including schema version and draft ETag.
- First mutation from an old saved version creates a current-shape draft.
- Save overwrites the selected unlocked version with current schema; Save As
  inserts a current-schema version.
- `check_project_document_upgrade.py --db` reads all saved versions and drafts
  inside a read-only transaction. It reports validation, schema steps, body
  size, and optional preview, but not target replacement counts.

## Exact persisted target

Only these typed row lists carry the built-in status:

```text
tables.project_materials[*].specification_status
tables.project_glazings[*].specification_status
tables.project_frames[*].specification_status
```

The v8 upgrader must replace only the value `missing` at those paths and stamp
schema version 8.

## Backend producers/consumers

Primary status contract/defaults:

- `project_document/envelope_models.py`
- `envelope/commands/materials.py`
- `project_document/apertures/_ref_helpers.py`
- `envelope/import_planning.py`
- `backend/seeds/project/assemblies.json`

Summary shims:

- `project_document/documentation_summary.py`
- `project_document/status_summary.py`

Other boundaries:

- `envelope/hbjson_import.py`
- `envelope/hbjson_export.py`
- `gh_api/constructions_export.py`
- `gh_api/aperture_types_export.py`
- `mcp/tools_envelope.py`
- Envelope/aperture command DTOs in `envelope/models.py`

## Frontend status surfaces

Built-in contracts and controls:

- `features/envelope/types.ts`
- `features/envelope/components/MaterialsPanel.tsx`
- `features/apertures/types.ts` (a separate union)
- `features/apertures/components/ApertureSpecReportPanel.tsx`
- `features/documentation/hooks.ts::typedSpecificationStatus`
- `shared/ui/report-table/StatusPill.tsx`
- `shared/ui/report-table/StatusFilterChips.tsx`
- `shared/ui/report-table/ReportTable.css`
- `shared/ui/StatusSelect.tsx` / `StatusSelect.css`

Apertures currently displays Missing. Materials displays Needed but stores and
filters on `missing`. Documentation currently converts built-in Needed/Unknown
writes back to `missing`.

Already canonical and regression-only:

- Documentation API/UI status values (`needed`, plus response sentinel
  `unknown`).
- Project Status summary UI (`needed`).
- Equipment/Thermal Bridges DataTable option ids, especially
  `opt_status_needed`.

## Honeybee boundary

Installed `honeybee_ref` 0.2.1 defines `REF_STATUS` as:

```text
COMPLETE | MISSING | QUESTION | NA
```

`gh_api/constructions_export.py` assigns the internal status to this property;
passing `needed` directly would raise `ValueError`. Direct/native HBJSON export
and legacy import must therefore use explicit versioned/boundary translation.

## UI token boundary

`--report-status-missing` is broader than specification status. It is used by
Documentation, Project Status, Climate, and shared controls. Rename status
keys/tones to `needed`, introduce a canonical needed token for status semantics,
and preserve a compatibility alias/distinct missing token where “missing” still
means absent data. Do not perform blind repo-wide replacement.

## Current baseline gap

The checkout's schema constant is v7, while
`backend/tests/project_document_schema/schema_fingerprint.json` still records
v6 and fixture versions v1/v4. Phase 00 must close this before v8 work; otherwise
schema-guard evidence is not trustworthy.

## Production risks

1. API and web deploy separately; a one-step strict enum switch permits
   old/new skew in both directions.
2. Existing drafts rewrite on first v8 read and change ETags.
3. After the first v8 persistence, app-only rollback to v7 is unsafe.
4. Raw JSON exports do not include drafts and are not a database rollback.
5. The repo has no verified production restore procedure documented for this
   event; Phase 04 must record the real provider/`pg_dump` mechanism, owner,
   retention, and restore procedure.
6. A repo-wide grep for the word `missing` produces many legitimate unrelated
   hits and is not an acceptance test.

## Required production audit extension

For each production source body, report:

- project/version/draft identity and source schema;
- count of `missing`, `needed`, and other allowed values at each target path;
- applied upgrade steps and current validation result;
- upgraded body size and preview hash;
- exact changed paths/count;
- second-pass byte identity.

Raw bodies/previews belong under gitignored `working/`. Commit only summarized
counts, hashes, and go/no-go evidence.

## Test inventory

Schema/backend:

- `test_project_document_schema_migrations.py`
- `test_project_document_schema_guard.py`
- `test_project_document_fielddef_drift.py`
- `test_project_document_upgrade_audit_cli.py`
- Documentation/Status summary tests
- materials/aperture command and import/export tests
- GH API export and MCP tests

Frontend:

- `ApertureSpecReportPanel.test.tsx`
- `EnvelopePage.test.tsx`
- `phase16-fixtures.ts`
- Documentation summary/editor tests, adding a built-in Needed write case
- shared report/status widget tests
- Equipment/Heat Pump/Thermal Bridge regressions proving
  `opt_status_needed` remains unchanged

Exclude generic missing-option, climate, geometry, catalog-drift, absent-value,
and missing-evidence tests from the value-rename sweep.
