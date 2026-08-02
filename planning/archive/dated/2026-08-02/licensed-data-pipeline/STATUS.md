---
DATE: 2026-07-28
UPDATED: 2026-08-02
TIME: 12:45 EDT
STATUS: Complete — all phases deployed, production-verified, and ready for
  archive
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Current state, next step, and blockers for the licensed-data pipeline.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./phases/
---

# Status

## State

**Complete 2026-08-02.** Both repositories' work is merged; PHN is deployed at
`87255adb`. Production applies are explicit Ed-dispatched Render one-off jobs,
licensed runtime data loads only through manifest-pinned immutable objects,
and DB-seed applies are audited, idempotent, and fail closed on any unmatched
target. The initial ISO 10456 µ dataset is applied to all 201 intended rows,
the repeat workflow is a no-op, and the retired ASHRAE legacy object is absent
while manifest-backed v1 continues to load.

The first production apply was a useful guard proof: all 201 targets were
unmatched because production still carried 408 pre-idempotency random catalog
IDs. The transaction rolled back every target change and wrote no audit row.
A reviewed one-time reconciliation then remapped all 408 canonical catalog
rows and the 22 saved material references to deterministic IDs, after which
the dataset applied 201/201. No name-based fallback was added to the permanent
applier contract.

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

None for v1. Future licensed datasets follow `context/DATASET_PIPELINE.md`.
D-11 and Q-3 remain explicitly non-blocking policy discussions for later
dataset inventory work.

## Blockers

| Blocker | Nature |
| --- | --- |
| ~~Q-1 repo name + repo creation~~ | ✅ **Done 2026-07-28** — `bldgtyp/ph-navigator-data` created, infra committed (`4321620`). |
| ~~R2 write token → repo Actions secrets~~ | ✅ **Done 2026-07-28** — token scoped to `ph-navigator-prod`, secrets + `R2_BUCKET` set, "Check R2 Credentials" workflow green. |
| ~~Q-2 apply-trigger confirmation (§D-5)~~ | ✅ Resolved — Ed-dispatched GitHub Actions → Render one-off job. |
| ~~Phase 3 production cutover~~ | ✅ **Done 2026-08-02** — Actions config, deploy, manifest-only proof, exact-key deletion, and post-delete proof passed. |
| ~~Phase 4 production apply~~ | ✅ **Done 2026-08-02** — 201/201 matched after the reviewed identity reconciliation; the repeat workflow returned `no_pending`. |
| ~~`catalog-seed-idempotency` interaction (§D-10)~~ | ✅ **Resolved 2026-08-02** — 408 canonical IDs and 22 saved references reconciled atomically; fail-closed behavior proved before the correction. |

## Verification

Phase gates:
- Phase 1: local validation, 8 synthetic tests, interrupted-publish drill
  (AC 4), and rollback-by-revert drill (AC 5) passed 2026-07-28. Hosted PR
  validation and main-branch publication also passed.
- Phase 2: focused tests, local operator/runtime drills, `make format`, and
  full `PYTEST_WORKERS=0 make ci` passed 2026-07-28.
- Phase 3: code/docs/focused tests are on `main`; films v1 is published; PHN
  deploy `30756462594` passed. Production loaded manifest-backed films before
  and after exact-key deletion. Private retirement dry-run `30757155794` and
  deletion run `30757191796` passed.
- Phase 4: local path passed 2026-07-29, including the private validation,
  deliberately unmatched precondition, 201/201 stable-id match, idempotent
  re-apply, one-row v2 update, rollback to reviewed v1, and final clean status.
  Private PR #2 squash-merged as `3a171f6`, and production publish run
  `30480924508` passed. The production apply run `30756751865` matched and
  updated 201/201 with `unmatched=0`; repeat run `30756804033` returned
  `no_pending`. Final production audit found one matching `applied_datasets`
  row, 22/22 saved material references resolved, and no orphan references.
- Closeout guard/reconciliation changes passed full CI before merge: backend
  `1771 passed, 7 skipped`; frontend `258` files / `2371` tests plus the
  production build. PHN PRs
  [#53](https://github.com/bldgtyp/ph-navigator-v2/pull/53) and
  [#54](https://github.com/bldgtyp/ph-navigator-v2/pull/54) merged as
  `5f91c55` and `87255adb`.
