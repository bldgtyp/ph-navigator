---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Implemented on branch - closeout checklist pending.
AUTHOR: Codex with Ed May
SCOPE: Phase 3 - audit CLI and beta recovery runbook.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ./phase-01-upgrade-harness.md
  - ./phase-02-golden-corpus.md
---

# Phase 3 - Audit CLI And Recovery Runbook

## Goal

Give the beta team a repeatable command that answers whether the known project
document corpus can upgrade before a schema bump ships.

## Scope

- Add a script such as:

```text
backend/scripts/check_project_document_upgrade.py
```

- Support at least:

```bash
cd backend && uv run python scripts/check_project_document_upgrade.py --fixtures
cd backend && uv run python scripts/check_project_document_upgrade.py --json-dir path/to/exported/project-documents
cd backend && uv run python scripts/check_project_document_upgrade.py --db --strict
```

- Report:
  - body counts by schema version;
  - future versions;
  - invalid bodies;
  - upgrade steps applied;
  - validation errors;
  - body sizes and largest body;
  - optional upgraded preview JSON path.
- Default to read-only operation.
- Add a short recovery runbook that uses raw JSON download plus the CLI.

## Acceptance Criteria

- The CLI audits committed fixtures.
- The CLI can audit local DB saved versions and drafts.
- The CLI exits nonzero in strict mode when upgrade/validation fails.
- The CLI does not write DB rows unless a future explicit repair mode is added.
- The recovery runbook is clear enough to use under beta pressure.

## Verification

- Unit tests for report classification where practical.
- One manual run against fixtures.
- One manual run against a local dev DB if one is available.

## Implementation Notes

Implemented 2026-06-27:

- Added `backend/scripts/check_project_document_upgrade.py`.
- Supported `--fixtures`, `--json-dir`, `--db`, `--strict`, and optional
  `--preview-dir`.
- Kept all modes read-only. DB mode reads `project_versions` and
  `project_version_drafts` inside a read-only transaction and never writes rows.
- The JSON report includes total body count, counts by schema version, future
  version count, invalid count, applied upgrade-step counts, largest upgraded
  body size, per-body stable error codes, exception types, and optional
  upgraded preview paths.
- Preview filenames include a short hash of the source label so colliding
  sanitized paths do not overwrite each other.
- Added `backend/tests/test_project_document_upgrade_audit_cli.py` for fixture
  corpus reporting, invalid/future classification, JSON directory discovery,
  preview output, and strict-mode nonzero exit.
- Added `recovery-runbook.md` with raw JSON download, `--json-dir`, and preview
  workflows.

## Verification Evidence

```bash
cd backend && uv run ruff check scripts/check_project_document_upgrade.py tests/test_project_document_upgrade_audit_cli.py
cd backend && uv run ty check scripts/check_project_document_upgrade.py tests/test_project_document_upgrade_audit_cli.py
cd backend && uv run pytest tests/test_project_document_upgrade_audit_cli.py
cd backend && uv run python scripts/check_project_document_upgrade.py --fixtures --strict
cd backend && uv run python scripts/check_project_document_upgrade.py --db --strict
```

Result: 5 passed; fixture audit passed for 2 fixture bodies; local DB audit
passed for 2 saved-version bodies and 0 draft bodies.
