---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Active - Phases 1-3 implemented on branch; Phase 4 next.
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
| 4 - FieldDef drift and schema-bump docs | Planned | Phase 3 audit CLI |
| 5 - beta gate drill and closeout | Planned | Phases 1-4 |

## Next Step

Start Phase 4 after the Phase 3 closeout commit:

```text
planning/features/beta-schema-evolution/phases/phase-04-fielddef-drift-docs.md
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
