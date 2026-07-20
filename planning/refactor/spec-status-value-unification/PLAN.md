---
DATE: 2026-07-19
TIME: 11:30 EDT
STATUS: Phase 02 implementation complete — Phase 03 required before merge
AUTHOR: Codex with Ed May
SCOPE: Release and implementation sequence for canonical specification status
  `needed` with two production projects.
RELATED:
  - ./PRD.md
  - ./decisions.md
  - ./research.md
  - ./phases/
---

# Plan — Specification-status value unification

## Release map

This is an expand/contract migration, not one atomic code edit.

| Phase | Release | Goal | Production mutation |
| --- | --- | --- | --- |
| 00 | none | Lock contract, inventory, and v7 prerequisite | none |
| 01 | Compatibility A | Make API/web version skew safe while v7 remains canonical | no schema change |
| 02 | Canonical B code | Implement v7 → v8 and canonical backend contract | local/test only |
| 03 | Canonical B code | Move frontend/API/MCP adapters and UI to `needed` | local/test only |
| 04 | none | Audit both production projects and establish go/no-go | read-only; backup only |
| 05 | Canonical B deploy | Deploy under write freeze; smoke before v8 writes | drafts may rewrite only after explicit gate |
| 06 | Canonical B operate | Verify both projects and cross the v8 write boundary deliberately | ordinary draft/save only |
| 07 | Cleanup C | Retire temporary client adapters; docs/closeout | no data rewrite |

## Sequence and dependencies

### Phase 00 — Contract and baseline

Phase 00 established a focused-schema-gates-green v7 branch and corrected its
stale v6 fingerprint guard. Production's current document schema is v4.
Compatibility A must therefore ride with the full v4 → v7 release and inherit
its production corpus audit/write-freeze/rollback gate. Persisted per-project
schema/draft counts are mandatory Phase 01 entry-gate evidence because the safe
dashboard inventory does not expose them.

Deliverables complete: `decisions.md`, `research.md`, the committed
`phase-00-inventory.md`, both production project identifiers in the gitignored
operator worksheet, and a focused-schema-gates-green v7 baseline.

Plan: `phases/phase-00-contract-baseline.md`.

### Phase 01 — Compatibility release A

Keep v7 storage and backend canonical `missing`, but make both stacks tolerate
the coming value. Backend mutation inputs accept `missing | needed` and
normalize to v7 `missing`. Frontend response boundaries accept either, display
Needed on Materials/Glazings/Frames, and still serialize legacy `missing`.

This release makes the later API/web skew safe and creates no v8 data. Its
status-rename changes are code-rollback-safe; whole-app rollback still depends
on whether production was already v7. Deploy and verify both production
projects before Phase 02/03 ships.

Implementation checkpoint: the complete entry corpus passed v4 → v7 and
structural validation, the compatibility/API/UI/build-marker candidate is
implemented, and local CI is green. The verified backup/restore gate, Ed's
review/merge/deploy, and both-project read-only production smoke remain open.

Plan: `phases/phase-01-compatibility-release.md`.

### Phase 02 — v8 upgrader and canonical backend

Add `_upgrade_v7_to_v8`, `UPGRADE_STEPS[7]`, schema v8, strict canonical
`SpecificationStatus`, defaults/producers, frozen v7 corpus, exact-diff tests,
seed updates, and summary pass-through. Add permanent Honeybee import/export
adapters and keep one named cached-client request adapter.

Implemented 2026-07-19; backend suite green. The v7 → v8 diff is exactly
`schema_version` plus the three permitted status values, and idempotence holds.
Not merge-eligible alone — Phase 03 must ship with it. See the phase doc's
as-built notes.

Plan: `phases/phase-02-v8-backend-migration.md`.

### Phase 03 — Canonical frontend and API consumers

Change both frontend unions, Materials/Apertures counts/filters/writes,
Documentation built-in writes, report status keys, status tones, and tests to
`needed`. Preserve `opt_status_needed`, `unknown`, generic evidence wording,
and unrelated `missing` states. Verify MCP/GH outputs and native/external export
behavior with the v8 backend.

Plan: `phases/phase-03-canonical-ui-adapters.md`.

### Phase 04 — Production preflight and go/no-go

With candidate B built and CI-green, audit a complete copy/export of every
saved version and draft for both production projects. Record exact replacement
counts and hashes. Resolve live drafts, close old tabs, confirm both users have
Compatibility A, establish a verified database restore point, and begin the
write freeze.

Plan: `phases/phase-04-production-preflight.md`.

### Phase 05 — Canonical deploy and no-write smoke

Ed triggers the production workflow. Wait for both API and web candidate SHAs,
then perform public and authenticated read-only smoke while writes remain
paused. Do not open a known stale draft until the go/no-go decision acknowledges
that draft reads can persist v8 and change ETags.

Plan: `phases/phase-05-deploy-no-write-smoke.md`.

### Phase 06 — Two-project verification and v8 write boundary

Verify Project 1, then Project 2, across Materials, Glazings, Frames,
Documentation, Status, Equipment, Thermal Bridges, HBJSON/GH exports, and raw
recovery download. Resume normal editing only after both read checks pass.
Allow v8 persistence through the next legitimate draft/Save or Save As; do not
fabricate a historical rewrite just to stamp a schema number.

The first persisted v8 draft/version is the rollback cliff. Record its project,
version/draft id, timestamp, and deployed SHA; from then on, default recovery is
roll-forward.

Plan: `phases/phase-06-project-verification-cutover.md`.

### Phase 07 — Compatibility cleanup and closeout

After Ed and John have refreshed and the observation window is clean, remove
temporary PH-Navigator-client compatibility code that no longer protects a
real client. Retain permanent v7 upgraders, frozen fixtures, raw-download
behavior, and Honeybee adapters. Run `simplify`, `docs-pass`, Graphify update,
full CI, context reconciliation, and archive closeout.

Plan: `phases/phase-07-cleanup-closeout.md`.

## Verification policy

- Phase 00: focused schema-baseline gates only.
- Phase 01: focused backend/frontend compatibility tests, full `make ci`, then
  both-project production smoke after Ed deploys.
- Phases 02–03 together: focused schema/domain/UI/export tests plus full
  `make ci` before candidate B is eligible.
- Phase 04: fixture audit, isolated DB/corpus audit, exact-diff report, backup
  evidence, and explicit go/no-go. No writes.
- Phases 05–06: public + authenticated production evidence under the runbook;
  no CI rerun substitutes for production checks.
- Phase 07: focused cleanup tests, `simplify`, `docs-pass`, Graphify, format,
  and full CI.

## Stop conditions

Stop the rollout if any of these is true:

- v7 baseline/fingerprint is not green;
- a production body fails candidate validation;
- a v7 intermediate's changed-count does not equal its legacy-value count at
  the three allowed paths;
- the v7 → v8 diff touches any other semantic value, or an older source's full
  diff cannot be explained by the named existing steps plus v7 → v8;
- any production draft is unaccounted for;
- backup/restore availability is not verified;
- previous/candidate Alembic heads and deploy-time DB/config changes are not
  inventoried, or app-only rollback compatibility is unproven;
- Ed/John cannot pause writes and close/refresh old tabs;
- API and web candidate SHAs are not both confirmed through version markers;
- either project fails the read-only smoke;
- a rollback is proposed after v8 persistence without restoring/repairing the
  database.

## Production authority

Implementation agents may prepare code, tests, audit artifacts, and operator
commands. They must not trigger `.github/workflows/deploy.yml`, modify
production data, discard production drafts, or resume production writes unless
Ed explicitly asks.
