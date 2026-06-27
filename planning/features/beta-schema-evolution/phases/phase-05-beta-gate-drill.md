---
DATE: 2026-06-27
TIME: 13:15 EDT
STATUS: Implemented on branch.
AUTHOR: Codex with Ed May
SCOPE: Phase 5 - beta gate drill and closeout.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../STATUS.md
---

# Phase 5 - Beta Gate Drill And Closeout

## Goal

Before real beta project data exists, run the complete schema-evolution drill
and record evidence that known project document bodies can upgrade.

## Scope

- Run fixture corpus upgrade tests.
- Run audit CLI against fixtures.
- Run audit CLI against local/demo project versions and drafts.
- If a staging/demo DB exists, run the audit against that corpus. This is the
  production-corpus drill half of `llm-mcp-schema.md` §10.5 (item 7); the per-PR
  fixture-corpus half (item 6) is the Phase 2 `pytest` that `make ci` runs.
- Verify read-safe recovery still handles unrecoverable invalid bodies.
- Update final docs and status.
- Run `graphify update .` after code changes.

Status: complete on branch. The local DB drill is the available corpus for this
worktree; no separate staging DB was available in this run.

## Acceptance Criteria

- Every known project document body audits cleanly or has a recorded exception.
- Future-version and invalid-body diagnostics are clear.
- No DB rows are mutated by read/audit flows.
- Docs identify the beta gate as complete.
- Context docs and feature docs no longer disagree.

Status: acceptance criteria met on branch.

## Verification

Expected closeout gates depend on the exact code touched, but should include:

- focused backend migration/drift/audit tests;
- audit CLI against fixtures;
- local DB audit if a dev DB is available;
- `make format`;
- broader `make ci` unless Ed explicitly narrows the gate;
- `graphify update .`.

Evidence:

```bash
make format
cd backend && uv run pytest tests/test_project_document_schema_migrations.py tests/test_project_document_fielddef_drift.py tests/test_project_document_schema_guard.py tests/test_project_document_upgrade_audit_cli.py
cd backend && uv run python scripts/check_project_document_upgrade.py --fixtures --fielddef-drift --strict
cd backend && uv run python scripts/check_project_document_upgrade.py --db --fielddef-drift --strict
make ci
```

Results:

- focused schema/audit tests: 14 passed;
- fixture audit: 2 bodies, schema version 1, 0 invalid, 0 future, 0 FieldDef drift;
- local DB audit: 2 saved-version bodies, 0 draft bodies, schema version 1, 0 invalid, 0 future, 0 FieldDef drift;
- `make ci`: backend 1133 passed / 2 skipped; frontend 1941 passed; frontend build succeeded.
