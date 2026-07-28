---
DATE: 2026-07-28
TIME: 12:05 EDT
STATUS: Active — packet drafted; Phase 1 (bootstrap `phn-data`) is next
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Current state, next step, and blockers for the licensed-data pipeline.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./phases/
---

# Status

## State

**Planning complete; no code, no repo created yet.**

Done 2026-07-28:
- Options analysis (private-git→CI→R2 vs tooling-only vs direct-git-consume)
  written up from the discussion with Ed; **Option A confirmed by Ed** —
  `decisions.md` Part 1, §D-1.
- Full contract drafted: `phn-data` layout + manifest invariants, R2 key
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

## Next step

**Phase 1 — bootstrap `phn-data`** (`phases/phase-01-phn-data-repo.md`).
First action is Ed's: create the private repo (Q-1: name) and a bucket-scoped
R2 API token for its Actions secrets. Everything after that is agent work.

## Blockers

| Blocker | Nature |
| --- | --- |
| Q-1 repo name + repo creation + R2 token | **Ed, at Phase 1 kickoff.** Creating private repos and minting Cloudflare tokens is operator work by definition. |
| Q-2 apply-trigger confirmation (§D-5) | Ed, in Phase 3. Does not gate Phases 1–2. |
| ⚠️ `catalog-seed-idempotency` interaction (§D-10) | Named risk for the Phase 4 µ applier (stable catalog row identity), not a blocker for Phases 1–3. |

## Verification

Nothing to verify yet. The standing gates, when phases land:
- Phase 1: the MinIO drill — interrupted publish (AC 4) and rollback-by-revert
  (AC 5) demonstrated locally.
- Phase 2: `make datasets-status` mismatch matrix (AC 6), apply idempotency
  (AC 7), films served from the manifest-pinned key (AC 9), fresh-dev boot
  with empty MinIO (AC 10).
- Phase 3: films production cutover verified by R2 round-trip, legacy key
  deleted, runbook in `context/DATASET_PIPELINE.md`.
- Phase 4: the µ dataset through the whole path locally, including the
  idempotent re-apply and the E-10 unmatched-row report.
