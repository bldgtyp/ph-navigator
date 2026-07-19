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
2. Record previous-production and candidate Alembic heads. Inventory every
   relational migration, environment/config change, and startup-command change
   bundled between the two SHAs; state whether the previous application is
   proven compatible with the candidate DB/config state.
3. Inventory both projects and every `project_versions` row: id, project id,
   active/locked/kind state, row/body schema, body size, and timestamps.
4. Inventory every `project_version_drafts` row. Name persisted
   `draft_etag`, persisted `base_version_etag`, and last-patched time
   separately. For saved versions, record the candidate-derived document ETag;
   it may change after in-memory upgrade without a DB-row mutation.
5. Take a preliminary read-only export/copy of every saved body and draft body
   so draft disposition is based on known/recoverable input. Raw per-version
   download is a recovery aid but does not cover drafts.
6. Ask Ed/John to resolve each existing draft deliberately through normal UI:
   Save, Save As, or Discard. Record disposition. Do not decide for them.
7. Close all PH-Navigator tabs, confirm both users will refresh after deploy,
   and begin the write freeze.
8. Establish the actual production database restore point after draft
   disposition and under the freeze. Record provider or `pg_dump` method,
   timestamp, retention, owner, restore procedure, and verification method.
9. Take a fresh authoritative read-only export of every saved version and draft
   row after dispositions. Use one named canonical serialization for hashes;
   do not compare a route's JSON text hash with a DB-export hash unless both use
   the same canonical serialization.
10. Run candidate-B audit code over this final corpus with strict validation,
   preview output, candidate hashes, and per-path replacement counts.
11. Audit every source body in two stages:
    - source schema → v7 intermediate: verify every applied existing step and
      its already-accepted fixture/validation contract;
    - v7 intermediate → v8: assert before `missing` count equals changed-value
      count, after target-path `missing` count is zero, and the exact diff is
      limited to schema stamp plus the three permitted status paths.
12. For source schemas older than v7, assert the full source → v8 diff equals
    the union of its named existing upgrade steps plus the v7 → v8 diff; do not
    require the older full diff to contain only status changes.
13. Assert every candidate output passes current validation/body-size limits
    and a second current-schema pass is byte-identical under canonical
    serialization.
14. Review previews for both active versions and every
    non-empty/locked/submitted historical version.
15. Rerun a final read-only DB inventory and compare row ids, schema metadata,
    ETags, sizes, timestamps, and canonical hashes with the authoritative
    post-disposition corpus. Any drift restarts steps 9–15.
16. Record an explicit GO or NO-GO signed by Ed.

## Go gate

GO requires zero invalid/future bodies; every old step explained; exact v7 → v8
diff reconciliation; zero unresolved drafts; verified restore point; row-metadata
and named canonical-hash identity between the frozen DB and final audited
corpus; closed/refreshed tabs; write freeze; and green API/web candidate SHA
markers. The previous/candidate Alembic/config inventory must identify either a
proven app-only rollback path or the restore/roll-forward path that replaces it.

## Stop conditions

- Any project/version/draft is absent from the final corpus.
- Any body fails, changes unexpectedly, or exceeds limits.
- Any v7 → v8 diff touches a non-target semantic value.
- An older full-chain diff cannot be explained by its named existing steps plus
  v7 → v8.
- Draft disposition is ambiguous.
- A backup exists but restore availability/procedure is unknown.
- Alembic/config drift makes the previous SHA incompatible and no restore or
  roll-forward response is ready.
- Production writes continue during the freeze.
- Candidate SHA changes after the audit.
- Final DB metadata/hash identity differs from the authoritative audited corpus.

## Committed evidence

Commit only a sanitized summary: project ids/names, row counts by schema,
aggregate target counts, named canonical artifact/candidate hashes, audit
result, previous/candidate Alembic heads, deploy-time DB/config classification,
restore-point metadata without secrets, candidate API/web SHAs, draft
dispositions, and GO/NO-GO. Do not commit raw bodies, credentials, URLs
containing secrets, or personal data.
