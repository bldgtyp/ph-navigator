---
DATE: 2026-11-23
TIME: 21:08 EST
STATUS: Complete
AUTHOR: Codex with Ed May (Phase 07 closeout 2026-11-23)
SCOPE: Current state and implementation gates for specification-status value
  unification.
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/76
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./decisions.md
  - ./research.md
  - ./phase-00-inventory.md
---

# Status — Specification-status value unification

**Issue:** [#76](https://github.com/bldgtyp/ph-navigator/issues/76)

## Current state

**Complete and archived (2026-11-23).** Commit `ef97b483` was deployed to
production on 2026-07-19 (manual dispatch), carrying Compatibility Release A
and Canonical Release B together. Both API and web reported the deployed SHA;
the public surface, CORS, and auth boundary were green; the deployed OpenAPI
schema advertised canonical `complete | needed | question | na` and no longer
offered `missing` at any of its 53 status enum sites.

Two production projects were verified read-only and **passed**: each stored
`schema_version=4` rows that read back as `8` through the forward-upgrade
chain, with zero legacy `missing` remaining across 61 material/glazing/frame
rows. The DataTable option-id family (`opt_status_needed`) remained intact and
untouched, as D-2 required.

**Phase 07 adapter retirement completed 2026-11-23:** removed the temporary
cached-client backend adapter (`backend/features/envelope/specification_status_compat.py`
and `ProjectMaterialMutation`) and frontend read-path wire normalizers
(`WireSpecificationStatus`, `WireSpecificationStatusRecord`,
`normalizeSpecificationStatus`, `normalizeSpecificationStatusRecord`,
`normalizeEnvelopeReadResponse`, `normalizeApertureSpecReport`). Public
commands and table replacements now enforce strict canonical
`SpecificationStatus`. Permanent v7 → v8 upgraders and Honeybee
`needed ↔ MISSING` adapters remain intact.

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

Nothing is blocking. Use the app normally; the first legitimate draft/Save
crosses the v8 write boundary — record its project, version/draft id, timestamp,
and deployed SHA when it happens (D-9), because app-only rollback ends there.

Once Ed and John have both reopened the app and a v8 body exists, retire the two
temporary adapters named in `phases/phase-07-cleanup-closeout.md` and ship them
with other work. Then archive this packet.

## Phase 00/01 evidence (historical)

Describes the Release-A state, since superseded by schema v8.

The v7 guard and focused schema gates were green. Release A accepted either
`missing` or `needed` at public mutation boundaries while persisting v7
`missing`, normalizes either response spelling at frontend API boundaries,
displays Needed across the specification-status UI, and adds exact API/web
build-SHA deployment gates. Exact corpus hashes, project names/ids, commands,
and operator results remain in the gitignored worksheet and audit artifacts.

## Deferred to Phase 07

`context/` is now fully synced: the backend-contract docs plus the UI-page and
normalization prose (`ui/pages/envelope-tab.md`, `ui/pages/overview-tab.md`,
`technical-requirements/data-table.md`, `DESIGN_SYSTEM.md`, and the frontend
styles README).

The later status-UX unification retired `--report-status-missing`; non-status
amber consumers now use `--attention-amber`.

## Open operator inputs

- ~~Production backup/snapshot mechanism, retention, restore owner, verified
  recovery procedure.~~ **Resolved 2026-07-20** — 3-day PITR plus manual logical
  exports (>= 7-day retention), restore owner Ed. Documented durably in
  `context/PRODUCTION_DEPLOYMENT.md` -> "Database Recovery". Note the PITR
  window for this cutover closes 2026-07-23.
- ~~Write freeze scheduling for Canonical B.~~ **Moot** — deployed with zero
  users and no open drafts.
- Duration of the Compatibility A observation/cache window before the temporary
  adapters are removed. Still Ed's call; see Phase 07.

## Phase ledger

| Phase | State | Exit gate |
| --- | --- | --- |
| 00 Contract/baseline | Complete | v7 baseline green; project ids recorded |
| 01 Compatibility A | Complete (deployed) | CI + both-project deployed smoke |
| 02 v8 backend | Complete (deployed) | corpus/exact-diff/domain/export gates green |
| 03 Canonical UI/adapters | Complete (deployed) | UI/wire/custom-option regressions green |
| 04 Production preflight | Complete (reduced form) | full corpus + restore point + go/no-go |
| 05 Deploy/no-write smoke | Complete | both SHAs + both-project reads green |
| 06 Project cutover | Verified; v8 write pending | both projects verified; v8 boundary logged |
| 07 Cleanup/closeout | Complete (2026-11-23) | adapters retired; docs/CI/archive complete |

## Completion checklist

- [x] Compatibility A deployed and verified (shipped together with B by agreement — zero users, see Phase 04).
- [x] Phase 00 v7 baseline, production identities, and status inventory complete.
- [x] Frozen v7 corpus covers all three built-in row paths.
- [x] v7 → v8 exact diff and idempotence proven.
- [x] Canonical built-in status is `needed` backend/frontend.
- [x] Apertures displays Needed, not Missing, for specification status.
- [x] Documentation built-in write emits `needed`.
- [x] Equipment/TB option ids remain unchanged.
- [x] Summary built-in translation shims removed.
- [x] Honeybee external `MISSING` compatibility proven.
- [x] Both production projects' versions audited (counts recorded; no drafts existed).
- [x] Verified restore point recorded (Render export 2026-07-20 00:14 EDT + 3-day PITR); write freeze moot — no users.
- [x] Both deployed SHAs and read-only smokes recorded.
- [ ] First v8 persisted write boundary recorded — **not yet crossed**.
- [x] `simplify`, `docs-pass`, format, and full CI complete.
- [x] Accepted durable contracts folded into `context/`.
- [x] Temporary cached-client adapters retired and packet archived (Phase 07, 2026-11-23).
