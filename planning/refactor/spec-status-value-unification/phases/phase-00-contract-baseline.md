---
DATE: 2026-07-19
TIME: 14:35 EDT
STATUS: Planned
AUTHOR: Codex with Ed May
SCOPE: Freeze the target contract and establish a trustworthy schema-v7 base.
RELATED:
  - ../PRD.md
  - ../decisions.md
  - ../research.md
---

# Phase 00 — Contract and v7 baseline

## Goal

Start the migration from an internally consistent, CI-green schema-v7 branch
and a complete surface/production inventory.

## Ordered steps

1. Rebase/reconcile against the branch that actually contains Documentation
   evidence schema v7. Preserve unrelated local edits.
2. Verify `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION`, `ProjectDocumentV1`'s
   literal, `UPGRADE_STEPS`, fixture expected outputs, and
   `schema_fingerprint.json` all describe the same v7 contract.
3. Close the current fingerprint gap without changing status semantics.
4. Run the schema-bump checklist's focused v7 tests and fixture audit.
5. Capture a scoped `rg` inventory of `SpecificationStatus`,
   `specification_status`, `typedSpecificationStatus`, `ReportStatusKey`,
   status tone/data attributes, seed values, MCP/GH/HBJSON boundaries, and
   relevant tests.
6. Classify each `missing` hit as:
   canonical target, temporary PHN compatibility, permanent external format,
   frozen historical fixture/raw body, or unrelated grammatical/data state.
7. Record Production Project 1 and 2 stable names/ids in a gitignored operator
   worksheet under `working/`; do not commit project data.
8. Confirm whether either production project has open user drafts before
   Compatibility A planning is finalized.

## Verification

```bash
cd backend
uv run pytest \
  tests/test_project_document_schema_migrations.py \
  tests/test_project_document_schema_guard.py \
  tests/test_project_document_fielddef_drift.py
uv run python scripts/check_project_document_upgrade.py \
  --fixtures --fielddef-drift --strict
```

Run `git diff --check` for planning/baseline edits. Do not run a production DB
audit in this phase.

## Exit gate

- v7 baseline is green and internally consistent.
- Surface inventory is classified, not a blind word-replacement list.
- Both production project ids are known.
- Existing production draft state is known or explicitly marked unavailable.

## Stop conditions

- Documentation schema v7 is not landed on the intended implementation base.
- Closing the fingerprint reveals fixture/validation drift beyond the v7 work.
- Production project identity cannot be determined safely.

## Evidence to record

- branch/SHA;
- schema constant, fingerprint version, and fixture versions;
- commands/results;
- production project ids/names and draft counts only (no bodies).
