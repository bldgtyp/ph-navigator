---
DATE: 2026-06-24
TIME: 18:05 EDT
STATUS: Blocked (run after Phase 3; D1 resolved)
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase 5 — squash migrations to one clean baseline + relational hygiene.
RELATED: ../decisions.md (D1, D4), ../PLAN.md,
         planning/code-reviews/2026-06-24/backend-data-architecture-review.md (REL-1..6, §7)
DEPENDS_ON: D1 resolved; run after Phase 3 (and parallel-safe with the sibling
            write-unification refactor) so the baseline captures final state.
---

# Phase 5 — Relational Clean Baseline

## Goal

Collapse 43 accreted migrations into one clean, convention-driven baseline, and
fold in the relational-hygiene fixes — so the schema's history-as-truth is a
single legible file with consistent naming, correct constraints, and the right
indexes. Only cheaply possible with no deployed DB.

## Changes

### 5.1 Squash 43 → one baseline (D1, REL-4, REL-5)
- Author `alembic/versions/<date>_0001_baseline.py` (replacing `0001`–`0043`)
  that creates the **current end-state** schema.
- Set `MetaData(naming_convention=...)` in `alembic/env.py` and give every
  constraint an explicit `name=` with a consistent prefix scheme
  (`pk_`/`fk_`/`uq_`/`ix_`/`ck_`) — kills the REL-5 hand-hardcoded-name smell
  and the mixed `ix_`/`ux_`/`uq_`/`idx_` drift.
- No app-code imports in the baseline (inline the seed literals from
  `_option_seeds` — REL-4 becomes moot since `0038`/`0041` disappear).
- Keep the old chain in git history; do not delete from history, only from the
  active `versions/` set.

### 5.2 Correctness + index fixes (REL-1, REL-3, REL-6, missing indexes)
Bake into the baseline:
- **REL-1:** `project_location.epw_asset_id` gets
  `FK … REFERENCES project_assets(id) ON DELETE SET NULL` (or, if Ed prefers the
  asset-purge-can't-fail looseness, leave unenforced but document it — recommend
  the FK).
- **REL-6:** drop `idx_user_table_views_project_lookup` (unused; PK covers it).
- **Missing indexes:** add `ix_user_action_log_user_created (user_id, created_at)`
  and `ix_project_versions_parent (parent_version_id)`. Consider
  `project_climate_source (project_id, kind)` (low priority — skip unless
  trivial).
- **REL-3:** ensure the climate-source resolve path tolerates a dangling
  `ref` (returns "source unavailable", not 500); add a note in
  `DATA_STORAGE.md` §5 that a `climate_dataset` re-seed can dangle `phius`/`phi`
  refs.

### 5.3 Turn on the boundary lint (D4)
With Phase-1 violations cleared, enable the feature-shape + import-boundary lint
in `make ci` so the layer discipline can't regress.

### 5.4 Finish the doc-staleness register
Clear the remaining review §8 `[PENDING]` items not already handled:
`data-model.md` §6.6.3 field-types (6→8: add `color`, `linked_record`);
`DATA_STORAGE.md` §5.3 climate `kind` table (`epw`/`ashrae` → `weather`);
`save-versioning.md` §8.3 (reconcile with the Phase-3 single-validator reality);
pool sizing/lifecycle written into `TECH_STACK.md`/`DATA_STORAGE.md` (from
Phase 6).

## Verification (the gate for D1)
1. Before deleting the old chain: on an empty DB run the **current** `0043` head,
   `pg_dump --schema-only > before.sql`.
2. On an empty DB run the **new** baseline, `pg_dump --schema-only > after.sql`.
3. `diff before.sql after.sql` must be empty except for the intended REL-1/REL-6/
   index/naming changes (review each remaining diff line deliberately).
4. Dev seed + climate seed + fixtures rebuild from scratch; `make ci` green.

## Acceptance criteria
- `alembic/versions/` contains one baseline (+ any post-baseline migrations
  created after this phase); `alembic upgrade head` from empty reproduces the
  schema (verified by 5.x diff).
- `env.py` has a `naming_convention`; no constraint relies on a Postgres-default
  name; no migration imports from `features/`.
- `epw_asset_id` FK present; dead index gone; new indexes present.
- Boundary lint enforced in CI and green.
- Review §8 register fully cleared.

## Risks
- **The squash must reproduce the schema exactly.** The dump-diff gate is the
  safety net; do not delete the old chain until it passes.
- Sequencing: run after Phase 3 so no later phase reopens the baseline
  (parallel-safe with the sibling write-unification refactor).
