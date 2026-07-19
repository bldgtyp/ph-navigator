---
DATE: 2026-07-19
TIME: 14:30 EDT
STATUS: Phase 00 complete — Phase 01 next
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

Phase 00 is complete. The local schema-v7 baseline is internally consistent,
the status surface inventory is classified, both production projects are
identified, and the deployed production code baseline is schema v4. No status
semantics, production body, draft, or saved version was changed.

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

Start Compatibility Release A's entry gate. Before compatibility code is
implemented, inventory every production saved-version schema and open draft
and run the v4 → v7 candidate over the complete read-only corpus. The safe
dashboard list does not expose those fields.

## Phase 00 evidence

The v7 guard and focused schema gates are green. Production runs schema-v4
code, so Compatibility A must carry the full v4 → v7 rollout controls. Exact
hashes, SHAs, commands, test results, and the classified surface inventory live
only in `phase-00-inventory.md`; project names/ids remain in the gitignored
operator worksheet.

## Open operator inputs (not design blockers)

- Persisted schema-version and draft-count inventory for both production
  projects before Compatibility A deploy.
- Actual production backup/snapshot mechanism, retention, restore owner, and
  verified recovery procedure.
- Duration of the Compatibility A observation/cache window before temporary
  adapters are removed.
- Scheduling of the Ed/John write freeze for Canonical B.

The persisted schema/draft inventory is a Phase 01 entry gate. Backup/restore
and write-freeze details are Phase 01 deployment gates and must be reconfirmed
in Phase 04. The observation/cache window is a Phase 07 cleanup input. No
production deploy proceeds while its applicable gate is blank.

## Phase ledger

| Phase | State | Exit gate |
| --- | --- | --- |
| 00 Contract/baseline | Complete | v7 baseline green; project ids recorded |
| 01 Compatibility A | Not started | CI + both-project deployed smoke |
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
