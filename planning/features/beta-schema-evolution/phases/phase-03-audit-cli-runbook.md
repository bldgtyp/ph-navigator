---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Planned - implementation not started.
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
python backend/scripts/check_project_document_upgrade.py --fixtures
python backend/scripts/check_project_document_upgrade.py --json-dir path/to/exported/project-documents
python backend/scripts/check_project_document_upgrade.py --db --strict
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

