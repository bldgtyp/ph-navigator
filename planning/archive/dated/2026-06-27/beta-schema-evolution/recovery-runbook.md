---
DATE: 2026-06-27
TIME: 12:30 EDT
STATUS: Complete - recovery runbook archived as the beta schema reference.
AUTHOR: Codex with Ed May
SCOPE: Operator steps for auditing and recovering project-document JSON during beta.
RELATED:
  - ./README.md
  - ./STATUS.md
  - ./phases/phase-03-audit-cli-runbook.md
---

# Beta Schema Recovery Runbook

## Normal Audit

Run the committed corpus before any project-document schema bump:

```bash
cd backend
uv run python scripts/check_project_document_upgrade.py --fixtures --strict
```

Include built-in `field_defs` drift in schema-bump drills:

```bash
cd backend
uv run python scripts/check_project_document_upgrade.py --fixtures --fielddef-drift --strict
```

Run the local DB audit before a beta deploy or drill:

```bash
cd backend
uv run python scripts/check_project_document_upgrade.py --db --fielddef-drift --strict
```

Both commands are read-only. A nonzero strict exit means at least one body needs
review before the schema bump ships.

## Raw JSON Recovery

If an editor or certifier hits read-safe recovery:

1. Download the raw project JSON from the affected version using the existing
   `/download` route.
2. Place one or more downloaded JSON files in a local folder.
3. Run:

```bash
cd backend
uv run python scripts/check_project_document_upgrade.py --json-dir /path/to/downloads --strict
```

For a current-schema preview without touching the database:

```bash
cd backend
uv run python scripts/check_project_document_upgrade.py \
  --json-dir /path/to/downloads \
  --preview-dir /tmp/phn-project-document-upgrades
```

The preview files are operator artifacts only. There is no DB repair mode in
beta; any write-back must be planned as an explicit maintenance task with
backup, review, and rollback.
