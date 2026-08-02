---
DATE: 2026-07-28
TIME: 12:05 EDT
UPDATED: 2026-08-02
STATUS: Complete — deployed, production-verified, and legacy object retired
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 3 — production apply trigger, films cutover, runbook, and
  retirement of the manual path.
RELATED: ../PRD.md §7, ../decisions.md §D-5, ../STATUS.md
---

# Phase 3 — Production trigger, cutover, docs

## Goal

The manual shell path is gone: publishing is a `ph-navigator-data` merge, applying is
an Ed-dispatched workflow, and the runbook exists.

## Decisions taken here

**Q-2 (§D-5):** Resolved by this implementation: manual-dispatch
GitHub Actions workflow **"Apply Production Datasets"** in this repo → Render
API one-off job on the API service running
`uv run python -m scripts.datasets_apply --all-pending` with the production
override. New secret: `RENDER_API_KEY` (+ service id as a variable).
Concurrency-grouped like `deploy.yml`.

## Work

1. **The workflow** per the confirmed Q-2 answer. Job output surfaces the
   `ApplyReport` (slugs/versions/row counts — no values, AC 12).
2. **Films production cutover** (first pipeline publish to prod R2):
   - `ph-navigator-data` CI publishes `ashrae-surface-films` v1 to the production
     bucket (values identical to what's live, so this is a no-op for users);
   - verify by R2 round-trip + `datasets_status` against prod (Render shell
     one last time, or the workflow's status mode);
   - restart/cache-reset; confirm the manifest-pinned path serves;
   - **delete the legacy `standards/ashrae/surface_films.json` key** and
     remove the Phase 2 fallback code (AC 9).
3. **Deprecate `scripts/seed_surface_films.py`** — replace its body with a
   pointer error, or delete it and update every doc that names it
   (`surface_film_store.py` docstring included).
4. **Docs**: new `context/DATASET_PIPELINE.md` (the runbook: adding a
   dataset, publishing, applying, rolling back, local dev, agent
   expectations) + pointers from `context/DATA_STORAGE.md` (class ④),
   `context/PRODUCTION_DEPLOYMENT.md` (the workflow), `context/ENVIRONMENT.md`
   (`make datasets-publish-local`), and the CLAUDE.md dispatch table row for
   data-storage work if the router needs it.

## Out of scope

The µ dataset (Phase 4); climate-bundle migration (deferred, §D-8).

## Branch result

Implemented:

- `.github/workflows/apply-production-datasets.yml`: `main` and deployed-SHA
  preflight, required config checks, Render one-off job creation/polling,
  job-scoped sanitized log retrieval, and serialized production concurrency;
- the ASHRAE loader is read-only and manifest-only; the unversioned fallback
  and its write API are removed;
- `scripts.seed_surface_films` is a pointer-only retired command;
- `context/DATASET_PIPELINE.md` is the canonical add/publish/apply/activate/
  rollback/failure runbook, linked from storage, environment, production,
  scripts, thermal, context-router, and root-router docs;
- focused Ruff/Ty clean; 79 focused dataset/envelope/deployment-contract tests
  pass; workflow YAML and every embedded shell block parse; the shared ref
  gate passes ShellCheck;
- required simplify review complete: reuse and quality findings fixed,
  efficiency clean;
- full `PYTEST_WORKERS=0 make ci` passes: backend `1663 passed, 7 skipped`;
  frontend `247` test files / `2312` tests passed; production build and
  version-marker check passed.

Completed operator steps:

- private `ph-navigator-data` PR #1 squash-merged as `8d4baa1`;
- its hosted main-branch publish completed successfully (Actions run
  `30418485049`), publishing films v1 and swapping the manifest last;
- this PHN implementation was squash-merged to `main`.

Completed 2026-08-02:

- Actions secret `RENDER_API_KEY` and variable `RENDER_API_SERVICE_ID` were
  configured;
- PHN deployed at commit `87255adb` (deploy run `30756462594`);
- production loaded `ashrae-surface-films` v1 through the manifest-only path;
- private PR [#3](https://github.com/bldgtyp/ph-navigator-data/pull/3)
  added an exact-key, checksum-guarded retirement workflow; dry-run
  `30757155794` and deletion run `30757191796` passed;
- the legacy `standards/ashrae/surface_films.json` object was verified absent,
  then a fresh Render job again loaded manifest-backed v1 successfully.

The ordering is load-bearing: do not deploy the manifest-only film loader
before the private dataset publish succeeds.

## Verification

Passed. Films served from the manifest-pinned key in production before and
after the legacy key was deleted (AC 9). The production apply workflow's
repeat dispatch returned `{"datasets":[],"status":"no_pending"}` and wrote
nothing (AC 7/11). The runbook and routing pointers shipped with the feature.
