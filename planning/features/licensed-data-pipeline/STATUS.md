---
DATE: 2026-07-28
UPDATED: 2026-07-29
TIME: 12:05 EDT
STATUS: Active — Phases 1–3 delivered; Phase 4 complete locally; Phase 3 live
  cutover and the production µ apply remain held; private µ publish complete
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Current state, next step, and blockers for the licensed-data pipeline.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./phases/
---

# Status

## State

**Phases 1–3 are delivered to their repositories' `main` branches. Private
PR [#1](https://github.com/bldgtyp/ph-navigator-data/pull/1) squash-merged as
`8d4baa1`, and its hosted production publish succeeded. PHN contains the
dataset registry/apply machinery and Phase 3 workflow/runbook. Phase 3 is not
live-complete: PHN Actions configuration, deployment, production verification,
the no-op dispatch, and legacy-key deletion remain. Phase 4's private payload,
local drill, and manifest-last production publish are complete; only its
production DB apply remains held.**

Done 2026-07-28:
- Options analysis (private-git→CI→R2 vs tooling-only vs direct-git-consume)
  written up from the discussion with Ed; **Option A confirmed by Ed** —
  `decisions.md` Part 1, §D-1.
- Full contract drafted: `ph-navigator-data` layout + manifest invariants, R2 key
  scheme, the PHN `datasets` feature (registry, `applied_datasets`,
  status/apply CLIs), production trigger recommendation, local-dev and agent
  stories, 4 phases, 12 acceptance criteria. → `PRD.md`.
- Ten design decisions, 13 edge cases, 4 open questions. → `decisions.md`.
- Grounding verified in-repo: `surface_film_store.py` (unversioned key — the
  first migration target), `climate/object_store.py` (versioned keys —
  grandfathered, §D-8), `seed_surface_films.py` / `seed_climate_bundle.py`
  (the manual publishers this replaces), `deploy.yml` + `backup-db.yml` (the
  workflow doctrine and connectivity precedents for §D-5).

## Sequencing

This feature was split out of `assembly-condensation-risk` on 2026-07-28 —
its D-7/Q-3 ("µ values live in the private DB; repo carries the loader only")
described *where* licensed data lives but left the publish/apply mechanics
manual. This packet is that mechanism, built first; the µ dataset is then its
first `db_seed` consumer (Phase 4 here = condensation Phase 1's seed path).

**Condensation is NOT blocked on all of this.** Its Phase 0 (coverage probe)
and Phase 1 (material fields) can proceed in parallel with pipeline Phases
1–3; only the µ *seeding run* itself waits for the pipeline.

## Phase 1 result

Already done 2026-07-28:
- ✅ Q-1 resolved — Ed created **`bldgtyp/ph-navigator-data`**
  (<https://github.com/bldgtyp/ph-navigator-data>), local clone at
  `~/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-data`.
- ✅ Repo infrastructure committed **and pushed** (README, CLAUDE.md with the
  hard rules, .gitignore, empty `manifest.json`, `datasets/` contract README)
  — commit `4321620`.
- ✅ **Browser-only credential check pushed** (`9b993d7`): the
  "Check R2 Credentials" `workflow_dispatch` Actions workflow +
  `tools/check_r2.py`. Verifying the token = clicking "Run workflow" on the
  Actions tab; failures print plain-language diagnoses. No local commands
  involved — Ed's standing requirement for credential setups.

- ✅ **R2 credentials wired and verified green** (2026-07-28, same day):
  `ph-navigator-data-publisher` token (Object Read & Write, scoped to
  `ph-navigator-prod`), three secrets + `R2_BUCKET` variable in the repo's
  Actions settings, **"Check R2 Credentials" run green**. One paste artifact
  (trailing `.` in `R2_BUCKET`) caught and fixed; the check now screens for
  punctuation artifacts (`02e4f49`).

Implemented on the private-repo feature branch (commit `b0bd933`):
- `tools/publish.py`: schema/checksum/key validation, git-base version gates,
  stable-slug protection, immutable conditional object creation, manifest-last
  publishing, and sanitized error output that cannot leak licensed values;
- `publish.yml`: PR/main validation, synthetic unit tests, serialized main
  publication, and publish gating to manifest/payload changes;
- `ashrae-surface-films` v1: exact bytes from the prior legacy object,
  schema, provenance, manifest entry;
- 8 synthetic publisher tests.

Local MinIO verification passed:
- interruption after immutable object upload left the prior manifest unchanged;
- clean re-run completed idempotently;
- rollback repointed the manifest from a later version to v1 while retaining
  both immutable objects;
- checksum:
  `90891d2bbab7008e049bc90067920a7d206e3a111640d2fd49ce4da190f5516a`.

Private PR [#1](https://github.com/bldgtyp/ph-navigator-data/pull/1)
squash-merged as `8d4baa1`. Hosted PR validation passed, followed by successful
main-branch publish run `30418485049`; the films v1 immutable object and
manifest-last swap are now published.

## Phase 2 result

Implemented in PHN:
- `features/datasets/`: typed manifest/integrity reader, executable registry,
  db-seed apply engine, per-slug transaction lock, applied-state repository,
  and full mismatch reconciliation;
- Alembic `20260728_0010`: `applied_datasets`;
- guarded `datasets_apply` and payload-safe `datasets_status` CLIs plus all
  three Make targets;
- ASHRAE films load and parse through the manifest-pinned registry entry;
  the temporary Phase 2 legacy fallback was removed by Phase 3 before merge,
  while a missing pinned object, checksum failure, or malformed payload
  hard-fails as typed unavailable;
- canonical storage/data-model docs now record the pipeline boundary.

Verification so far:
- focused Ruff + Ty clean;
- 76 focused dataset/envelope tests pass;
- backend feature-boundary check passes;
- Alembic current/head both `20260728_0010`;
- `make datasets-publish-local` idempotently republishes films v1;
- `make datasets-status` reports published=1, loaded=1, checksum match, no
  mismatches;
- `make datasets-apply ARGS=--all-pending` reports no pending db-seed data;
- live local runtime load reports `ashrae-surface-films` v1 without printing
  licensed values.
- `make format` passes;
- final full `PYTEST_WORKERS=0 make ci` passes: backend
  `1663 passed, 7 skipped`;
  frontend `247` test files / `2312` tests passed; production build and
  version-marker check passed.

## Next step

**Two independent resumptions remain:**

1. Finish the remaining Phase 3 PHN-side live cutover below.
2. Apply the published production `iso10456-vapor-mu` dataset through the
   Phase 3 workflow after the application version carrying its catalog columns
   is deployed. The local Phase 4 drill and private publish are complete.

Before Phase 3 can close live: configure Actions secret `RENDER_API_KEY` and
variable `RENDER_API_SERVICE_ID`; explicitly deploy PHN; verify the
manifest-only films path; dispatch the no-pending drill; delete the retired
legacy object. The private data merge/publish and PHN merge are complete.

## Blockers

| Blocker | Nature |
| --- | --- |
| ~~Q-1 repo name + repo creation~~ | ✅ **Done 2026-07-28** — `bldgtyp/ph-navigator-data` created, infra committed (`4321620`). |
| ~~R2 write token → repo Actions secrets~~ | ✅ **Done 2026-07-28** — token scoped to `ph-navigator-prod`, secrets + `R2_BUCKET` set, "Check R2 Credentials" workflow green. |
| ~~Q-2 apply-trigger confirmation (§D-5)~~ | ✅ Resolved — Ed-dispatched GitHub Actions → Render one-off job. |
| Phase 3 production cutover | Private publish and PHN merge are complete. Actions `RENDER_API_KEY` / `RENDER_API_SERVICE_ID` are absent; explicit deploy, manifest-only verification, no-op dispatch, and legacy R2-key deletion remain. |
| Phase 4 production apply | Local payload/applier/drill and private PR #2 publication are complete. Production DB apply waits for Ed's manual dispatch after a deployed PHN version carries the two catalog columns. |
| ⚠️ `catalog-seed-idempotency` interaction (§D-10) | Named risk for the Phase 4 µ applier (stable catalog row identity), not a blocker for Phases 1–3. |

## Verification

Phase gates:
- Phase 1: local validation, 8 synthetic tests, interrupted-publish drill
  (AC 4), and rollback-by-revert drill (AC 5) passed 2026-07-28. Hosted PR
  validation and main-branch publication also passed.
- Phase 2: focused tests, local operator/runtime drills, `make format`, and
  full `PYTEST_WORKERS=0 make ci` passed 2026-07-28.
- Phase 3: code/docs/focused tests are on `main`, and films v1 is published.
  PHN configuration/deploy, manifest-only production verification,
  legacy-key deletion, and no-pending workflow dispatch remain.
- Phase 4: local path passed 2026-07-29, including the private validation,
  deliberately unmatched precondition, 201/201 stable-id match, idempotent
  re-apply, one-row v2 update, rollback to reviewed v1, and final clean status.
  Private PR #2 squash-merged as `3a171f6`, and production publish run
  `30480924508` passed. Production DB apply remains held.
