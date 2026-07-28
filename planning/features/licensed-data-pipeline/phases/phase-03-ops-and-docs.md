---
DATE: 2026-07-28
TIME: 12:05 EDT
STATUS: Planned
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 3 — production apply trigger, films cutover, runbook, and
  retirement of the manual path.
RELATED: ../PRD.md §7, ../decisions.md §D-5, ../STATUS.md
---

# Phase 3 — Production trigger, cutover, docs

## Goal

The manual shell path is gone: publishing is a `phn-data` merge, applying is
an Ed-dispatched workflow, and the runbook exists.

## Decisions taken here

**Q-2 (§D-5):** Ed confirms the apply trigger. Recommended: manual-dispatch
GitHub Actions workflow **"Apply Production Datasets"** in this repo → Render
API one-off job on the API service running
`uv run python -m scripts.datasets_apply --all-pending` with the production
override. New secret: `RENDER_API_KEY` (+ service id as a variable).
Concurrency-grouped like `deploy.yml`.

## Work

1. **The workflow** per the confirmed Q-2 answer. Job output surfaces the
   `ApplyReport` (slugs/versions/row counts — no values, AC 12).
2. **Films production cutover** (first pipeline publish to prod R2):
   - `phn-data` CI publishes `ashrae-surface-films` v1 to the production
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

## Verification

Films served from the manifest-pinned key in production with the legacy key
deleted (AC 9); a dry-run dispatch of the workflow with nothing pending
reports "nothing to apply" and writes nothing (AC 7/11); docs-pass run so the
runbook and pointers land in the same change.
