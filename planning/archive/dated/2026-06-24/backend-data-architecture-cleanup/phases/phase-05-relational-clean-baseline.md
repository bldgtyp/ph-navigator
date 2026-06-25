---
DATE: 2026-06-24
TIME: 22:10 EDT
STATUS: Complete
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

## Implementation Notes

- Replaced the pre-deploy Alembic chain (`20260512_0001` through
  `20260624_0043`) with `20260624_0001_baseline.py`.
- Kept seed data literal in the baseline: catalog field options, frame types,
  and glazing types. The baseline does not import application feature modules.
- Added `MetaData(naming_convention=...)` in `alembic/env.py` and normalized
  active constraint/index names into the baseline.
- Baked in the intended relational hygiene deltas:
  `fk_project_location_epw_asset`, no `idx_user_table_views_project_lookup`,
  `ix_user_action_log_user_created`, and `ix_project_versions_parent`.
- Added `scripts.check_backend_boundaries` to backend CI and fixed the only
  live violation by moving `/ready` DB probing into `features.system.service`.
- Added a regression test proving `project_climate_source` reads tolerate a
  dangling `phius`/`phi` reference instead of 500ing.
- Reconciled the stale context docs for catalog/climate storage, field types,
  current-only document schema versioning, migration baseline, and boundary CI.

## Verification

- Old chain control DB: created empty `phn_phase5_before`, upgraded to old
  `20260624_0043`, and dumped schema to `/tmp/phn_phase5/before.sql`.
- New baseline DB: created empty `phn_phase5_after`, upgraded to
  `20260624_0001`, and dumped schema to `/tmp/phn_phase5/after.sql`.
- Column signature compare: no differences across 246 column signatures.
- Constraint signature compare: old 209, new 210; the only intended addition is
  `fk_project_location_epw_asset`.
- Index signature compare: exactly the intended deltas:
  add `project_versions(parent_version_id)`,
  add `user_action_log(user_id, created_at)`,
  remove `user_table_views(project_id, table_key)`.
- Static baseline seed counts on a fresh DB:
  `catalog_field_options=71`, `catalog_frame_types=1`,
  `catalog_glazing_types=1`.
- Fresh baseline introspection confirmed the FK is not deferrable, the two new
  indexes exist, and `idx_user_table_views_project_lookup` is absent.
- Focused test slice:
  `DATABASE_URL=... uv run pytest tests/test_project_climate_source.py tests/test_projects.py tests/test_system_routes.py tests/test_catalog_field_options.py tests/test_catalog_field_options_glazing.py tests/test_climate_dataset_roster.py`
  — 68 passed.
- Closeout gates:
  `make format`; recreate `ph_navigator_v2_test`; `make ci` — backend 1105
  passed, 2 skipped; frontend 1900 passed; frontend build passed;
  `graphify update .` — 13713 nodes, 36309 edges, 610 communities.
- Known gate noise: initial xdist workers saw stale local worker DB stamps at
  `20260624_0043` after the squash, then recovered; the final suite passed.

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
