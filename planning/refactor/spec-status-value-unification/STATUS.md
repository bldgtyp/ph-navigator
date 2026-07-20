---
DATE: 2026-07-19
TIME: 11:30 EDT
STATUS: Candidate B implemented (Phases 02+03) — deployment pending
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

Candidate B is complete: Phase 02 (schema v8 canonical backend) and Phase 03
(canonical frontend/API consumers) are both implemented, `make ci` is green,
and the UI was browser-verified. `needed` is now canonical end to end —
backend literal, storage schema, API payloads, and every status control, count,
filter, and token in the UI.

Browser verification ran against the seeded starter project, whose saved body is
still schema **v7** with legacy `missing` values, so it exercised the v7 → v8
read path with real stored data rather than freshly-written v8 rows.

Nothing was deployed. No production body, draft, saved version, or status value
was changed. Release A remains implemented and undeployed; candidate B must not
deploy ahead of it.

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

**Ed's call — the remaining phases are production operations, not code.**
Phase 04 (audit both production projects, verified restore point, write freeze,
go/no-go), Phase 05 (deploy + no-write smoke), and Phase 06 (two-project
verification and the deliberate v8 write boundary) all require Ed's explicit
authorization; implementation agents must not trigger them. Phase 07 cleanup
runs only after the post-deploy observation window.

Before any of that: Ed reviews and merges the Release-A + candidate-B branch,
and closes the verified backup/restore gate. Do not use a real project mutation
as a smoke test.

## Phase 00 evidence

The v7 guard and focused schema gates remain green. Release A accepts either
`missing` or `needed` at public mutation boundaries while persisting v7
`missing`, normalizes either response spelling at frontend API boundaries,
displays Needed across the specification-status UI, and adds exact API/web
build-SHA deployment gates. Exact corpus hashes, project names/ids, commands,
and operator results remain in the gitignored worksheet and audit artifacts.

## Deferred to Phase 07

`context/` is now fully synced: the backend-contract docs plus the UI-page and
normalization prose (`ui/pages/envelope-tab.md`, `ui/pages/status-tab.md`,
`technical-requirements/data-table.md`, `DESIGN_SYSTEM.md`, and the frontend
styles README).

One deliberate carry-forward: `--report-status-missing` remains as an alias of
`--report-status-needed` for its non-status consumers (Climate data gaps,
Documentation write errors and zero meters). Renaming it to something neutral is
CSS-architecture work that D-8 and the Phase 03 stop conditions exclude from
this rollout. See the Phase 03 as-built notes.

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
| 02 v8 backend | Implemented | corpus/exact-diff/domain/export gates green |
| 03 Canonical UI/adapters | Implemented | UI/wire/custom-option regressions green |
| 04 Production preflight | Blocked on Ed (production op) | full corpus + restore point + go/no-go |
| 05 Deploy/no-write smoke | Blocked on Ed (production op) | both SHAs + both-project reads green |
| 06 Project cutover | Blocked on Ed (production op) | both projects verified; v8 boundary logged |
| 07 Cleanup/closeout | Blocked on the observation window | adapters retired as approved; docs/CI/archive |

## Completion checklist

- [ ] Compatibility A deployed and verified before Canonical B.
- [x] Phase 00 v7 baseline, production identities, and status inventory complete.
- [x] Frozen v7 corpus covers all three built-in row paths.
- [x] v7 → v8 exact diff and idempotence proven.
- [x] Canonical built-in status is `needed` backend/frontend.
- [x] Apertures displays Needed, not Missing, for specification status.
- [x] Documentation built-in write emits `needed`.
- [x] Equipment/TB option ids remain unchanged.
- [x] Summary built-in translation shims removed.
- [x] Honeybee external `MISSING` compatibility proven.
- [ ] Both production projects' versions/drafts audited with hashes/counts.
- [ ] Verified restore point and write freeze recorded.
- [ ] Both deployed SHAs and read-only smokes recorded.
- [ ] First v8 persisted write boundary recorded.
- [ ] `simplify`, `docs-pass`, Graphify, format, and full CI complete.
- [ ] Accepted durable contracts folded into `context/` and packet archived.
