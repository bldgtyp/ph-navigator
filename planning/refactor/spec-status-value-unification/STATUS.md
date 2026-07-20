---
DATE: 2026-07-19
TIME: 11:30 EDT
STATUS: Phase 02 implementation complete — Phase 03 required before merge
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

Phase 02's schema-v8 backend is implemented and the backend suite is green
(1456 passed). `needed` is now the strict canonical backend value: the v7 → v8
upgrader, `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 8`, canonical defaults and
factories, typed summary pass-through, permanent Honeybee adapters, the frozen
v7 corpus, and the audit CLI's rename diagnostics all landed. Phase 01's
Release-A code remains implemented and undeployed.

Phase 02 is deliberately not merge-eligible on its own: the shipping frontend
still serializes `missing`, so Phase 03 must land with it. Nothing was deployed
and no production body, draft, saved version, or status value was changed.

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

Implement Phase 03 (canonical frontend/API consumers) so candidate B is
complete, then run full `make ci` across both phases. Ed's Release-A
review/merge/deploy and the verified backup/restore gate remain open and
unchanged — Phase 02/03 code must not deploy ahead of them. Do not use a real
project mutation as a smoke test.

## Phase 00 evidence

The v7 guard and focused schema gates remain green. Release A accepts either
`missing` or `needed` at public mutation boundaries while persisting v7
`missing`, normalizes either response spelling at frontend API boundaries,
displays Needed across the specification-status UI, and adds exact API/web
build-SHA deployment gates. Exact corpus hashes, project names/ids, commands,
and operator results remain in the gitignored worksheet and audit artifacts.

## Deferred to Phase 03/07

Backend-contract docs in `context/` were synced with this phase
(`data-model.md`, `llm-mcp-schema.md`, `envelope-hbjson-import.md`,
`envelope-hbjson-export.md`). The UI-presentation and normalization prose that
still says `missing` — `context/ui/pages/envelope-tab.md`,
`context/ui/pages/status-tab.md`, `context/technical-requirements/data-table.md`
— is left for Phase 03, which is what makes those statements true end-to-end.

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
| 02 v8 backend | Implemented; merges with 03 | corpus/exact-diff/domain/export gates green |
| 03 Canonical UI/adapters | Not started | UI/wire/custom-option regressions green |
| 04 Production preflight | Not started | full corpus + restore point + go/no-go |
| 05 Deploy/no-write smoke | Not started | both SHAs + both-project reads green |
| 06 Project cutover | Not started | both projects verified; v8 boundary logged |
| 07 Cleanup/closeout | Not started | adapters retired as approved; docs/CI/archive |

## Completion checklist

- [ ] Compatibility A deployed and verified before Canonical B.
- [x] Phase 00 v7 baseline, production identities, and status inventory complete.
- [x] Frozen v7 corpus covers all three built-in row paths.
- [x] v7 → v8 exact diff and idempotence proven.
- [ ] Canonical built-in status is `needed` backend/frontend.
- [x] Apertures displays Needed, not Missing, for specification status.
- [ ] Documentation built-in write emits `needed`.
- [x] Equipment/TB option ids remain unchanged.
- [x] Summary built-in translation shims removed.
- [x] Honeybee external `MISSING` compatibility proven.
- [ ] Both production projects' versions/drafts audited with hashes/counts.
- [ ] Verified restore point and write freeze recorded.
- [ ] Both deployed SHAs and read-only smokes recorded.
- [ ] First v8 persisted write boundary recorded.
- [ ] `simplify`, `docs-pass`, Graphify, format, and full CI complete.
- [ ] Accepted durable contracts folded into `context/` and packet archived.
