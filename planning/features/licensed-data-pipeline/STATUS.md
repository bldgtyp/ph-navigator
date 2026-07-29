---
DATE: 2026-07-28
TIME: 12:05 EDT
STATUS: Active — Phase 1 implemented on branch; Phase 2 is next
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Current state, next step, and blockers for the licensed-data pipeline.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./phases/
---

# Status

## State

**Phase 1 is implemented and locally verified on
`ph-navigator-data:feat/licensed-data-pipeline` at `b0bd933`; Phase 2 is next
in PHN.**

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

Pending outside the branch implementation: private-repo PR review/merge and
its first hosted Actions run. Merge is the production publish event, so it is
not performed as part of the local phase commit.

## Next step

**Phase 2 — implement PHN's `datasets` feature**
(`phases/phase-02-datasets-feature.md`).

## Blockers

| Blocker | Nature |
| --- | --- |
| ~~Q-1 repo name + repo creation~~ | ✅ **Done 2026-07-28** — `bldgtyp/ph-navigator-data` created, infra committed (`4321620`). |
| ~~R2 write token → repo Actions secrets~~ | ✅ **Done 2026-07-28** — token scoped to `ph-navigator-prod`, secrets + `R2_BUCKET` set, "Check R2 Credentials" workflow green. |
| Q-2 apply-trigger confirmation (§D-5) | Ed, in Phase 3. Does not gate Phases 1–2. |
| ⚠️ `catalog-seed-idempotency` interaction (§D-10) | Named risk for the Phase 4 µ applier (stable catalog row identity), not a blocker for Phases 1–3. |

## Verification

Phase gates:
- Phase 1: local validation, 8 synthetic tests, interrupted-publish drill
  (AC 4), and rollback-by-revert drill (AC 5) passed 2026-07-28. Hosted
  Actions remains pending until the private branch is opened/merged.
- Phase 2: `make datasets-status` mismatch matrix (AC 6), apply idempotency
  (AC 7), films served from the manifest-pinned key (AC 9), fresh-dev boot
  with empty MinIO (AC 10).
- Phase 3: films production cutover verified by R2 round-trip, legacy key
  deleted, runbook in `context/DATASET_PIPELINE.md`.
- Phase 4: the µ dataset through the whole path locally, including the
  idempotent re-apply and the E-10 unmatched-row report.
