---
DATE: 2026-07-28
TIME: 12:05 EDT
STATUS: Active — Phases 1–3 implemented on feature branches; production
  cutover held for Ed; Phase 4 local proof remains
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Router for the licensed-data pipeline feature.
RELATED: ./PRD.md, ./decisions.md, ./STATUS.md, ./phases/,
  context/DATA_STORAGE.md, planning/features/assembly-condensation-risk/
---

# Licensed-data pipeline (`ph-navigator-data` → R2 → PHN)

Replace the manual Render-shell publishing of licensed reference data with an
automated, versioned pipeline: a **private GitHub repo is the source of
truth** — **`bldgtyp/ph-navigator-data`**
(<https://github.com/bldgtyp/ph-navigator-data>, local clone
`~/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-data`) — its CI **publishes to
the private R2 bucket**, and PHN gains a small **`datasets` feature** that
reads, applies, and audits what's published.

This is infrastructure built *first*, then *used* by
`assembly-condensation-risk` (the ISO 10456 µ dataset is its Phase 1 seed) and
every licensed table after it.

## Why now

Three licensed datasets already flow through the private object store — the
climate bundles, the ASHRAE surface-film table, and (next) the ISO 10456 µ
values — and each was or would be published by hand: an operator running a
seed script in a Render shell. That is unversioned, unreviewable,
unrepeatable, and it does not scale past the person who did it last time.
(`decisions.md` §D-1.)

## Read order

1. **`PRD.md`** — the contract: the `ph-navigator-data` repo layout, the R2 key/manifest
   scheme, the PHN `datasets` feature (registry, `applied_datasets`, CLIs),
   publish/apply/rollback flows, phasing, acceptance criteria.
2. **`decisions.md`** — options A/B/C and why A won, the ten design decisions,
   edge cases, and the open questions (repo name, apply trigger).
3. **`STATUS.md`** — current state and next step.
4. **`phases/`** — one file per phase.

## The three things to know

1. **The app's read side barely changes.** PHN already reads licensed data
   only from the private object store (MinIO locally, R2 in production) —
   `surface_film_store.py` and `climate/object_store.py` are the proof. This
   feature adds *where the data comes from* (a reviewed git repo instead of an
   operator's shell) and *how we know what's applied* (a manifest + an
   `applied_datasets` table), not a new runtime dependency. Production never
   talks to GitHub.

2. **Two dataset kinds, one registry.** `runtime_read` datasets (surface
   films) are fetched from R2 at serve time via a manifest-pinned versioned
   key. `db_seed` datasets (the µ values) are applied into Postgres by an
   idempotent applier that records `(name, version, checksum, applied_at)`.
   Think Alembic-for-data. (`PRD.md` §5.)

3. **Open seed data stays in this repo.** The split is by *license*, not by
   kind: `backend/seeds/*` (synthetic/own data) keeps its zero-credential
   local-dev and test story. Only licensed data routes through `ph-navigator-data`.
   (`decisions.md` §D-2.)

## Phase map

| Phase | Content |
| --- | --- |
| **1** | ✅ **Implemented on branch 2026-07-28** (`ph-navigator-data` commit `b0bd933`) — standalone publisher, schema/checksum/version gates, serialized publish CI, `ashrae-surface-films` v1, synthetic contract tests, and MinIO interruption + rollback drills. Production publish awaits review/merge of the private-repo branch. |
| **2** | ✅ **Implemented on branch 2026-07-28** (`06064906`) — manifest/integrity store, registry, guarded/status/apply CLIs, `applied_datasets`, per-slug apply serialization, Make targets, and manifest-pinned film loading with temporary legacy fallback |
| **3** | 🟡 **Branch implementation complete 2026-07-28** — Ed-dispatched Render one-off workflow, canonical runbook, manifest-only film loader, retired `seed_surface_films.py`; production publish/deploy/status/delete/no-op-dispatch sequence is intentionally held for Ed |
| **4** | ⏸ **Held at prerequisite boundary 2026-07-28** — first `db_seed` end-to-end proof waits for condensation Phase 0's target-roster/composite policy and Phase 1's µ/sd catalog columns; no licensed payload or placeholder applier authored |

Phases 1–2 are independently valuable (versioned source + auditability);
Phase 3 removes the last manual step; Phase 4 is the proof by first consumer.
