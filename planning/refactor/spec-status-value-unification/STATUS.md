---
DATE: 2026-07-19
TIME: 14:30 EDT
STATUS: Planned — awaiting plan review
AUTHOR: Codex with Ed May
SCOPE: Current state and implementation gates for specification-status value
  unification.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./decisions.md
  - ./research.md
---

# Status — Specification-status value unification

## Current state

Planning and codebase research are complete. No implementation code, tests,
schema changes, production access, or production writes were performed in this
planning pass.

The packet is now implementation-ready, subject to Ed's review of the
expand/contract rollout and the production-project interpretation below.

## Accepted planning conclusions

- Use the established forward-only v7 → v8 dict upgrader; a model validator is
  not the migration mechanism.
- Preserve historical saved rows. “Update both production projects” means all
  versions/drafts prove upgradeable and current typed reads use v8 semantics;
  active work persists v8 on later ordinary draft/Save/Save As.
- Keep Equipment/Thermal Bridges on `opt_status_needed`.
- Keep permanent Honeybee `needed ↔ MISSING` adapters.
- Use Compatibility A before Canonical B so independently deployed API/web
  versions tolerate each other.
- Treat the first persisted v8 draft/version as the point after which app-only
  rollback to v7 is unsafe.
- Keep generic “missing evidence/data/row” language out of the enum rename.
- Keep status-pill CSS consolidation out of this migration.

## Next step

Review/approve the planning packet. If accepted, start Phase 00:

1. reconcile the current branch's schema-v7 fingerprint/fixture baseline;
2. identify the two production projects by stable id/name in the operator
   checklist;
3. implement Compatibility Release A only.

## Known prerequisite

Current checkout evidence:

- branch: `codex/documentation-page-redesign`;
- `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 7`;
- committed `schema_fingerprint.json` still reports schema version `6` and
  fixture versions `v1`, `v4`;
- unrelated working-tree edits exist in
  `DocumentationRecordViews.tsx` and `StatusSelect.css`.

Do not start v8 on a failing or internally inconsistent v7 baseline. Preserve
the unrelated edits.

## Open operator inputs (not design blockers)

- Stable name/id of Production Project 1 and Production Project 2.
- Current production API/web SHA and whether v7 has already been deployed.
- Actual production backup/snapshot mechanism, retention, restore owner, and
  verified recovery procedure.
- Duration of the Compatibility A observation/cache window before temporary
  adapters are removed.
- Scheduling of the Ed/John write freeze for Canonical B.

These must be filled during Phases 00/04; no production deploy proceeds while
they are blank.

## Phase ledger

| Phase | State | Exit gate |
| --- | --- | --- |
| 00 Contract/baseline | Not started | v7 baseline green; project ids recorded |
| 01 Compatibility A | Not started | CI + both-project deployed smoke |
| 02 v8 backend | Not started | corpus/exact-diff/domain/export gates green |
| 03 Canonical UI/adapters | Not started | UI/wire/custom-option regressions green |
| 04 Production preflight | Not started | full corpus + restore point + go/no-go |
| 05 Deploy/no-write smoke | Not started | both SHAs + both-project reads green |
| 06 Project cutover | Not started | both projects verified; v8 boundary logged |
| 07 Cleanup/closeout | Not started | adapters retired as approved; docs/CI/archive |

## Completion checklist

- [ ] Compatibility A deployed and verified before Canonical B.
- [ ] Frozen v7 corpus covers all three built-in row paths.
- [ ] v7 → v8 exact diff and idempotence proven.
- [ ] Canonical built-in status is `needed` backend/frontend.
- [ ] Apertures displays Needed, not Missing, for specification status.
- [ ] Documentation built-in write emits `needed`.
- [ ] Equipment/TB option ids remain unchanged.
- [ ] Summary built-in translation shims removed.
- [ ] Honeybee external `MISSING` compatibility proven.
- [ ] Both production projects' versions/drafts audited with hashes/counts.
- [ ] Verified restore point and write freeze recorded.
- [ ] Both deployed SHAs and read-only smokes recorded.
- [ ] First v8 persisted write boundary recorded.
- [ ] `simplify`, `docs-pass`, Graphify, format, and full CI complete.
- [ ] Accepted durable contracts folded into `context/` and packet archived.
