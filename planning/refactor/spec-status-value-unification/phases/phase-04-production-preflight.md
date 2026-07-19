---
DATE: 2026-07-19
TIME: 14:35 EDT
STATUS: Planned — production authority required for access
AUTHOR: Codex with Ed May
SCOPE: Audit both production projects and establish the Canonical B go/no-go.
RELATED:
  - ../PLAN.md
  - ../../../archive/dated/2026-06-27/beta-schema-evolution/recovery-runbook.md
---

# Phase 04 — Production preflight

## Goal

Prove candidate v8 can read every production body and establish a recoverable,
quiet cutover before any candidate deployment or write.

## Preconditions

- Compatibility A is deployed and verified.
- Candidate B (Phases 02–03) is review-complete and full CI is green.
- Ed authorizes production read access and backup/export operations.

## Ordered operator steps

1. Create a gitignored `working/spec-status-v8-production-audit/` worksheet.
2. Inventory both projects and every `project_versions` row: id, project id,
   active/locked/kind state, row/body schema, body size, and timestamps.
3. Inventory every `project_version_drafts` row: version id, user id, schema,
   ETag, size, and last-patched time.
4. Export/copy every saved body and draft body without mutation. Raw per-version
   download is a recovery aid but does not cover drafts; use a read-only DB
   export/snapshot for the complete corpus.
5. Hash each raw artifact. Store bodies only in `working/` or protected
   operator storage; never commit them.
6. Run candidate-B audit code over the copied corpus with strict validation,
   preview output, and per-path replacement counts.
7. For every body, assert:
   - applied steps are expected for its source schema;
   - before `missing` count equals changed-value count;
   - after `missing` count is zero at target paths;
   - non-target semantic diff count is zero;
   - second pass is byte-identical;
   - upgraded body passes size/validation.
8. Review previews for both active versions and every non-empty/locked/submitted
   historical version.
9. Ask Ed/John to resolve each existing draft deliberately: Save, Save As, or
   Discard through normal UI. Record disposition. Do not decide for them.
10. Close all PH-Navigator tabs and confirm both users will refresh after the
    deploy.
11. Establish the actual production database restore point. Record provider or
    `pg_dump` method, timestamp, retention, owner, restore procedure, and how
    restore availability was verified.
12. Begin the write freeze and rerun a final read-only inventory to ensure no
    draft/version changed after the snapshot.
13. Record an explicit GO or NO-GO signed by Ed.

## Go gate

GO requires zero invalid/future bodies, exact diff reconciliation for every
body, zero unresolved drafts, verified restore point, stable final inventory,
closed/refreshed tabs, write freeze, and green candidate SHA.

## Stop conditions

- Any project/version/draft is absent from the corpus.
- Any body fails, changes unexpectedly, or exceeds limits.
- Draft disposition is ambiguous.
- A backup exists but restore availability/procedure is unknown.
- Production writes continue during the freeze.
- Candidate SHA changes after the audit.

## Committed evidence

Commit only a sanitized summary: project ids/names, row counts by schema,
aggregate target counts, artifact hashes, audit result, restore-point metadata
without secrets, candidate SHA, draft dispositions, and GO/NO-GO. Do not commit
raw bodies, credentials, URLs containing secrets, or personal data.
