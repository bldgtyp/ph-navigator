---
DATE: 2026-07-19
TIME: 14:35 EDT
STATUS: Planned — production authority required
AUTHOR: Codex with Ed May
SCOPE: Verify both production projects and deliberately enter normal schema-v8
  operation.
RELATED:
  - ./phase-05-deploy-no-write-smoke.md
  - ../decisions.md
---

# Phase 06 — Two-project verification and cutover

## Goal

Verify real workflows in both production projects, then resume ordinary work
with the rollback boundary explicitly understood.

## Ordered steps

### Project 1 verification

1. Confirm current active version, lock state, and expected absence/disposition
   of drafts against Phase 04.
2. Verify Materials, Glazings, Frames status filters/counts/pills/selects use
   Needed and match preflight counts.
3. Verify Documentation built-in and custom-status records agree with owning
   tables; preserve `unknown` behavior where no source exists.
4. Verify Status dashboard rollups and inspect Equipment/TB Needed values
   read-only. Do not edit: cell/status changes immediately persist a server
   draft even before explicit Save.
5. Verify current MCP/GH typed reads use `needed` and rich Honeybee construction
   export still carries valid external `MISSING`.
6. Verify raw download remains the historical stored schema/value where
   expected; do not mistake reserialized raw recovery JSON for a failed typed
   migration.

### Project 2 verification

7. Repeat steps 1–6 independently; do not infer success from Project 1.

### Persistent cutover

8. If both projects pass, Ed ends the write freeze.
9. Allow the next legitimate user edit to create a v8 draft. Do not fabricate a
   no-op or bulk rewrite solely to stamp v8.
10. On the first v8 persistence, record project/version/draft id, user,
    timestamp, deployed SHA, schema, persisted `draft_etag`, persisted
    `base_version_etag`, and candidate-derived version ETag. Mark rollback mode
    `ROLL-FORWARD`.
11. Verify that draft reads/writes, Save, and Save As continue normally. When
    each production project's next legitimate save occurs, record that its
    active/new version is now persisted v8. Historical versions remain raw at
    their original schema.
12. Rerun the read-only production audit. Expected mixed state is valid:
    historical schemas upgrade; new drafts/saves are v8; all typed results are
    canonical Needed.

## Exit gate

- Both projects pass the full status/export/read verification.
- Editing resumes only after both pass.
- First v8 persistence and rollback-mode change are recorded.
- No forced historical rewrite occurred.
- Any project not yet physically saved as v8 has an explicit “next legitimate
  Save/Save As” note, not a false completion claim.

## Recovery

Before first v8 persistence, use Phase 05 rollback. Afterward, prefer a forward
hotfix that continues to read v8. Database restore loses post-snapshot work and
requires Ed's explicit decision. A reverse `needed → missing`, `8 → 7` repair is
not implemented by this feature and must not be improvised in production.

## Stop conditions

- Project counts differ from preview without an explained intervening edit.
- Any external Honeybee export rejects Needed.
- An old/cached tab sends a rejected status write.
- A proposed rollback ignores persisted v8 rows.
