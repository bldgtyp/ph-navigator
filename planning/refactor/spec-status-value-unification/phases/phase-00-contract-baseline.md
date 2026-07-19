---
DATE: 2026-07-19
TIME: 14:35 EDT
STATUS: Complete
AUTHOR: Codex with Ed May
SCOPE: Freeze the target contract and establish a trustworthy schema-v7 base.
RELATED:
  - ../PRD.md
  - ../decisions.md
  - ../research.md
---

# Phase 00 — Contract and v7 baseline

## Goal

Start the migration from an internally consistent schema-v7 branch with green
focused schema-baseline gates and a complete surface/production inventory.

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
8. Record the deployed production API/web SHA and deployed-code schema. Record
   the persisted schema-version inventory when a non-mutating authenticated
   route is available; otherwise bind it explicitly to Compatibility A's
   predeploy corpus audit. Decide whether v7 is already the production baseline
   or Compatibility A must carry the full production → v7 rollout.
9. If production is pre-v7, import the v7 release's corpus, write-freeze,
   backup, and post-first-v7-write roll-forward boundary into Phase 01 evidence.
10. Confirm whether either production project has open user drafts before
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
- Production SHA/deployed-code schema baseline and the v7 rollout path are
  explicit; persisted-body schema counts are recorded or explicitly gated
  before Compatibility A deploy.
- Existing production draft state is known or explicitly marked unavailable.

## Stop conditions

- Documentation schema v7 is not landed on the intended implementation base.
- Closing the fingerprint reveals fixture/validation drift beyond the v7 work.
- Production project identity cannot be determined safely.

## Evidence to record

- branch/SHA;
- schema constant, fingerprint version, and fixture versions;
- commands/results;
- production project ids/names and draft counts in the gitignored operator
  worksheet only (no bodies).

## Completion evidence — 2026-07-19

The v7 guard and focused schema gates are green. Production runs schema-v4
code, so Compatibility A must carry v4 → v7 controls. Persisted schema/draft
counts are a mandatory read-only Phase 01 entry gate. Exact evidence and the
classified surface inventory live in `../phase-00-inventory.md`; production
project names/ids remain in the gitignored operator worksheet.
