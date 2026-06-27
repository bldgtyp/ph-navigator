---
DATE: 2026-06-27
TIME: 13:15 EDT
STATUS: Complete on branch - beta gate drill passed.
AUTHOR: Codex with Ed May
SCOPE: Current state, next step, blockers, verification for beta schema evolution.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./decisions.md
---

# STATUS

## Current State

- The 2026-06-27 code review recommends keeping the current JSONB/Pydantic
  project-document architecture and adding a small schema-evolution lane.
- Ed accepted all open-decision recommendations on 2026-06-27.
- This active feature packet now owns the beta schema-evolution work.
- Phase 1 is implemented on branch as of 2026-06-27 11:59 EDT.
- Phase 2 is implemented on branch as of 2026-06-27 12:21 EDT.
- Phase 3 is implemented on branch as of 2026-06-27 12:37 EDT.
- Phase 4 is implemented on branch as of 2026-06-27 13:05 EDT.
- Phase 5 is implemented on branch as of 2026-06-27 13:15 EDT.
- The beta gate drill passed against fixtures and the local DB corpus.

## Decision Ledger

| Decision | State |
|---|---|
| D0 - read-time forward-only upgrade chain | Resolved |
| D1 - real beta data trigger | Resolved |
| D2 - old saved rows remain old | Resolved |
| D3 - DB body rewrites explicit maintenance only | Resolved |
| D4 - no repair/import UI before beta | Resolved |
| D5 - built-in display names are product schema | Resolved |
| D6 - drafts may be upgraded in place; versions may not | Resolved |
| D7 - ETag describes the upgraded body | Resolved |
| D8 - dict-to-dict steps only; no per-version models | Resolved |
| D9 - raw JSON download stays un-upgraded | Resolved |

## Phase Ledger

| Phase | State | Blocker |
|---|---|---|
| 1 - project-document upgrade harness | Implemented on branch | none |
| 2 - golden corpus and regression tests | Implemented on branch | none |
| 3 - audit CLI and recovery runbook | Implemented on branch | none |
| 4 - FieldDef drift and schema-bump docs | Implemented on branch | none |
| 5 - beta gate drill and closeout | Implemented on branch | none |

## Next Step

Review and merge the feature branch when ready:

```text
codex/beta-schema-evolution-loop
```

## Blockers

None for planning.

None for implementation.

## Verification Posture

- focused backend tests for project document validation, drafts, saved versions,
  migration errors, and fixtures;
- audit CLI run against fixtures;
- appropriate broader gates at closeout;
- `graphify update .` after code changes.

## Verification Evidence

Phase 1:

```bash
cd backend && uv run ruff check tests/test_project_document.py tests/test_mcp.py tests/project_document_helpers.py features/project_document/migrations features/project_document/validation.py features/project_document/store.py features/project_document/repository.py features/project_document/write_spine.py
cd backend && uv run ty check tests/test_project_document.py tests/test_mcp.py tests/project_document_helpers.py features/project_document/migrations features/project_document/validation.py features/project_document/store.py features/project_document/repository.py features/project_document/write_spine.py
cd backend && uv run pytest tests/test_project_document.py tests/test_mcp.py::test_mcp_read_tools_return_document_and_structured_write_rejection
```

Result: 38 passed.

Phase 2:

```bash
cd backend && uv run ruff check tests/test_project_document_schema_migrations.py
cd backend && uv run ty check tests/test_project_document_schema_migrations.py
cd backend && uv run pytest tests/test_project_document_schema_migrations.py
```

Result: 2 passed.

Phase 3:

```bash
cd backend && uv run ruff check scripts/check_project_document_upgrade.py tests/test_project_document_upgrade_audit_cli.py
cd backend && uv run ty check scripts/check_project_document_upgrade.py tests/test_project_document_upgrade_audit_cli.py
cd backend && uv run pytest tests/test_project_document_upgrade_audit_cli.py
cd backend && uv run python scripts/check_project_document_upgrade.py --fixtures --strict
cd backend && uv run python scripts/check_project_document_upgrade.py --db --strict
```

Result: 5 passed; fixture audit passed for 2 fixture bodies; local DB audit
passed for 2 saved-version bodies and 0 draft bodies.

Phase 4:

```bash
cd backend && uv run ruff check features/project_document/fielddef_drift.py scripts/check_project_document_upgrade.py tests/test_project_document_fielddef_drift.py tests/test_project_document_schema_guard.py tests/test_project_document_upgrade_audit_cli.py
cd backend && uv run ty check features/project_document/fielddef_drift.py scripts/check_project_document_upgrade.py tests/test_project_document_fielddef_drift.py tests/test_project_document_schema_guard.py tests/test_project_document_upgrade_audit_cli.py
cd backend && uv run pytest tests/test_project_document_fielddef_drift.py tests/test_project_document_schema_guard.py tests/test_project_document_upgrade_audit_cli.py
```

Result: 12 passed.

Phase 5:

```bash
make format
cd backend && uv run pytest tests/test_project_document_schema_migrations.py tests/test_project_document_fielddef_drift.py tests/test_project_document_schema_guard.py tests/test_project_document_upgrade_audit_cli.py
cd backend && uv run python scripts/check_project_document_upgrade.py --fixtures --fielddef-drift --strict
cd backend && uv run python scripts/check_project_document_upgrade.py --db --fielddef-drift --strict
make ci
```

Result: focused schema/audit tests 14 passed; fixture audit passed for 2
fixture bodies with 0 FieldDef drift; local DB audit passed for 2 saved-version
bodies and 0 draft bodies with 0 FieldDef drift; `make ci` passed with backend
1133 passed / 2 skipped, frontend 1941 passed, and frontend build succeeded.
