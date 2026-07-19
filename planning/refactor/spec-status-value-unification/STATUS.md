---
DATE: 2026-07-19
TIME: 11:30 EDT
STATUS: Phase 01 implementation complete — production deployment pending
AUTHOR: Codex with Ed May
SCOPE: Current state and implementation gates for specification-status value
  unification.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./decisions.md
  - ./research.md
  - ./phase-00-inventory.md
---

# Status — Specification-status value unification

## Current state

Phase 01's Release-A code is implemented and CI-green. The complete read-only
production entry corpus contained two schema-v4 saved bodies across the two
named projects and no open drafts; both bodies passed the existing v4 → v7
candidate and strict structural validation. No production body, draft, saved
version, service, or status value was changed.

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

Ed reviews and merges the Release-A candidate, then completes the verified
backup/restore and rollback gate before explicitly triggering production
deployment. After both API/web SHA markers match, run authenticated read-only
smoke on both projects. Do not use a real project mutation as a smoke test.

## Phase 00 evidence

The v7 guard and focused schema gates remain green. Release A accepts either
`missing` or `needed` at public mutation boundaries while persisting v7
`missing`, normalizes either response spelling at frontend API boundaries,
displays Needed across the specification-status UI, and adds exact API/web
build-SHA deployment gates. Exact corpus hashes, project names/ids, commands,
and operator results remain in the gitignored worksheet and audit artifacts.

## Open operator inputs (not design blockers)

- Actual production backup/snapshot mechanism, retention, restore owner, and
  verified recovery procedure.
- Duration of the Compatibility A observation/cache window before temporary
  adapters are removed.
- Scheduling of the Ed/John write freeze for Canonical B.

The persisted schema/draft inventory entry gate is complete. Backup/restore
and write-freeze details remain Phase 01 deployment gates and must be
reconfirmed in Phase 04. The observation/cache window is a Phase 07 cleanup
input. No production deploy proceeds while its applicable gate is blank.

## Phase ledger

| Phase | State | Exit gate |
| --- | --- | --- |
| 00 Contract/baseline | Complete | v7 baseline green; project ids recorded |
| 01 Compatibility A | Implementation complete; deploy pending | CI + both-project deployed smoke |
| 02 v8 backend | Not started | corpus/exact-diff/domain/export gates green |
| 03 Canonical UI/adapters | Not started | UI/wire/custom-option regressions green |
| 04 Production preflight | Not started | full corpus + restore point + go/no-go |
| 05 Deploy/no-write smoke | Not started | both SHAs + both-project reads green |
| 06 Project cutover | Not started | both projects verified; v8 boundary logged |
| 07 Cleanup/closeout | Not started | adapters retired as approved; docs/CI/archive |

## Completion checklist

- [ ] Compatibility A deployed and verified before Canonical B.
- [x] Phase 00 v7 baseline, production identities, and status inventory complete.
- [ ] Frozen v7 corpus covers all three built-in row paths.
- [ ] v7 → v8 exact diff and idempotence proven.
- [ ] Canonical built-in status is `needed` backend/frontend.
- [x] Apertures displays Needed, not Missing, for specification status.
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
