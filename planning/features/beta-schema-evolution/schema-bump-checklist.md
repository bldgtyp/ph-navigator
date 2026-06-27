---
DATE: 2026-06-27
TIME: 13:05 EDT
STATUS: Active checklist for future project-document schema bumps.
AUTHOR: Codex with Ed May
SCOPE: Required steps before changing persisted project-document structure.
RELATED:
  - ./README.md
  - ./STATUS.md
  - ./recovery-runbook.md
  - ../../../context/technical-requirements/llm-mcp-schema.md
---

# Schema-Bump Checklist

Use this checklist before changing persisted project-document structure,
including built-in `field_defs`.

## In-Scope Lane

`CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` in
`backend/features/project_document/document.py` owns the versioned JSONB project
document. It covers:

- `ProjectDocumentV1` serialized shape;
- table envelopes and row shapes;
- built-in `field_defs`, including display names, field types, Number units,
  linked-record config, defaults, and option-list namespaces;
- saved versions and drafts.

The drift reporter and fingerprint guard cover built-in option-list namespaces
and FieldDef defaults. They do not compare persisted option-list contents
(`id`, `label`, `color`, `order`) because those lists are stored project data
and may be edited through the schema/option surface.

## Out-Of-Scope Lanes

- `SUPPORTED_VIEW_STATE_SCHEMA_VERSION` in `backend/features/table_views/models.py`
  is cache/state hygiene. Keep this lightweight unless product requirements
  make old table views meaningful.
- `BUNDLE_SCHEMA_VERSION` in `backend/features/climate/bundle.py` is a static
  climate object-store asset lane. Do not couple it to project-document bumps.
- Catalog-derived row drift for project materials, glazings, and frames remains
  owned by existing catalog drift tooling. This checklist covers built-in
  `field_defs`, not catalog row refresh semantics.

## Required Steps

1. Add a dict-to-dict forward upgrade step under
   `backend/features/project_document/migrations/`.
2. Bump `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION`.
3. Add at least one old-shape fixture under
   `backend/tests/project_document_schema/fixtures/v*/inputs/` and the expected
   upgraded snapshot under the matching `expected/` folder. Never regenerate old
   fixture inputs to hide drift.
4. Update `backend/tests/project_document_schema/schema_fingerprint.json` only
   after the version bump and fixture addition are in place. The guard test
   detects structural drift against this committed file; code review must reject
   guard-file refreshes that do not include the bump and fixture evidence.
5. Run:

```bash
cd backend
uv run pytest tests/test_project_document_schema_migrations.py \
  tests/test_project_document_schema_guard.py \
  tests/test_project_document_fielddef_drift.py
uv run python scripts/check_project_document_upgrade.py --fixtures --fielddef-drift --strict
```

6. Run the local or staging DB drill:

```bash
cd backend
uv run python scripts/check_project_document_upgrade.py --db --fielddef-drift --strict
```

7. If drift is intentional, encode it in the upgrade step or a read-time overlay
   before merging. Do not leave stale built-in labels/types/config to be
   discovered by users.
