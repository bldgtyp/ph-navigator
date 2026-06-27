---
DATE: 2026-06-27
TIME: 10:55 EDT
STATUS: Complete
AUTHOR: Claude
SCOPE: Implementation plan for resolving the deferred DataTable status-field backfill in a fresh-start database with no users and no old project documents.
RELATED: planning/archive/dated/2026-06-27/datatable-status-backfill/README.md, planning/archive/dated/2026-06-27/datatable-status-backfill/STATUS.md
---

# Plan — Resolve Status Backfill as Fresh-Start No-Op

## Decision

Do **not** implement a historical project-document backfill right now.
PH-Navigator V2 has no users and no old project documents to preserve, so the
right implementation is a verification + closeout pass:

1. keep the existing forward-only status-field contract for fresh documents;
2. avoid a schema-version bump, read-time migration, Alembic data migration, or
   one-off script;
3. verify fresh project creation / seed reset paths still create the 12 status
   FieldDefs, namespaced option lists, and seeded row values;
4. archive or mark this packet as resolved-unneeded once the checks pass.

Closeout result: Phase 01 passed on 2026-06-27; Phase 02 completed by marking
the packet Complete and archiving it as resolved-unneeded.

## Non-Goals

- No migration of `project_versions.body` or `project_version_drafts.body`.
- No `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` bump.
- No read-time document upgrade layer.
- No default injection into existing rows. Existing-row default fill remains
  forward-only.
- No dashboard implementation. This packet only decides whether the status
  field needs historical backfill.

## Phase 01 — Verify Fresh-Start Contract

Goal: prove there is nothing to migrate and that fresh documents already have
the status data the future completeness dashboard would need.

Checks:

1. Confirm `STATUS_TABLE_NAMES` still lists exactly the intended 12 tables.
2. Confirm registered table contracts carrying `field_key == "status"` match
   `STATUS_TABLE_NAMES`.
3. Confirm `empty_project_document()` / seed helpers populate
   `single_select_options["<table>.status"]` for every status table.
4. Confirm seeded rows exercise the status option values through
   `custom_values.status`.
5. Confirm no code path has introduced a project-document migration layer or
   version bump.

Suggested commands:

```bash
cd backend
uv run pytest \
  tests/test_seed_dev_db.py::test_starter_project_document_seeds_status_options_and_values \
  tests/test_seed_dev_db.py::test_status_table_names_match_registered_contracts \
  tests/test_project_document_default_option_fill.py::test_existing_row_not_backfilled_when_default_now_set
```

Manual grep check:

```bash
rg -n "CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION|read_safe|status-backfill|STATUS_TABLE_NAMES" \
  features/project_document tests scripts alembic/versions
```

Exit criteria:

- Targeted tests pass.
- No project-document migration/backfill path exists or is needed.
- Fresh-start behavior remains the documented source of truth.

## Phase 02 — Close The Planning Packet

Goal: make the planning state match the product decision.

Actions:

1. Update `STATUS.md` from `Deferred / not implemented` to
   `Complete` or `Superseded` with the reason:
   `resolved as unnecessary before first deploy; no historical project
   documents exist`.
2. Keep the implementation note explicit: no migration was written because
   there is no data to migrate.
3. Update `planning/STATUS.md` to remove this from active follow-up routing or
   mark it as resolved-unneeded.
4. Archive the packet under
   `planning/archive/dated/<YYYY-MM-DD>/datatable-status-backfill/` if this
   repo's current closeout flow wants completed feature packets archived.

Exit criteria:

- The current planning index no longer presents this as a future migration task.
- The archive/status note preserves the rationale in case the question returns.

## Reopen Rule

Reopen only if PHN later imports or preserves real project documents that
predate the built-in `status` field. In that case, do not reuse this no-op plan;
write a real migration plan that chooses whether pre-existing rows default to
`opt_status_needed` or remain unset.
