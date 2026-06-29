---
DATE: 2026-06-29
TIME: 16:38 EDT
STATUS: Draft phased implementation sequence with success gates.
AUTHOR: Codex
SCOPE: Step-by-step implementation plan for production climate data enablement.
RELATED:
  - README.md
  - PRD.md
  - STATUS.md
  - phases/
---

# Production Climate Data Seeding - Plan

## Sequence overview

This is an operator workflow, not a code feature. The sequence must be run in
order because later phases depend on evidence from earlier phases.

1. Audit production state and decide seed mode.
2. Publish PHIUS and PHI bundles to production R2.
3. Seed Render Postgres from the published bundles.
4. Smoke the live production app, including Hourly Data.
5. Close out with durable evidence and rerun rules.

## P00 - Production readiness audit

Detailed handoff: `phases/phase-00-production-readiness-audit.md`.

Tasks:

- Confirm `ph-navigator-api` has production R2 and DB env vars.
- Confirm `render.prod.yaml` still points production at `ph-navigator-prod`.
- Confirm R2 CORS/public-access posture.
- Check whether `climate_dataset` already has production rows.
- Check whether any project already has `phius` or `phi` sources.
- Re-run read-only local source parse to confirm counts.
- Decide seed mode: `--no-replace` for first/new rows, plain `--all` only for
  deliberate rebuild.

Success gate:

- A written audit exists in `STATUS.md` or a phase evidence note with target
  bucket, source counts, current DB counts, existing project-source count, and
  chosen seed command.

## P01 - Publish R2 reference bundles

Detailed handoff: `phases/phase-01-publish-r2-reference-bundles.md`.

Tasks:

- Export production R2 credentials in a local operator shell.
- Use full source paths, not `backend/seeds/climate`.
- Run `features.climate.processing --upload` for:
  - `phius/2022`
  - `phi/10.6`
- Verify both objects exist with HEAD/list checks.

Success gate:

- R2 contains:
  - `climate/phius/2022/dataset.json`
  - `climate/phi/10.6/dataset.json`
- Processing output reports non-empty counts matching the audit.

## P02 - Seed Render Postgres

Detailed handoff: `phases/phase-02-seed-render-postgres.md`.

Tasks:

- Open Render Shell or one-off Job for `ph-navigator-api`, root `backend`.
- Run the selected seed command, normally:

  ```bash
  uv run python -m features.climate.seeding --all --no-replace
  ```

- Query DB counts by provider/version.
- Confirm skipped providers, if any, are intentional.

Success gate:

- Production DB count query shows `phius/2022` and `phi/10.6` seeded.
- Counts match accepted source counts unless an operator records why not.

## P03 - Production UI and API smoke

Detailed handoff: `phases/phase-03-production-ui-and-api-smoke.md`.

Tasks:

- Sign in to `https://www.ph-nav.com`.
- Use a production project with location set.
- Open PHIUS picker and confirm station roster appears.
- Use Find Nearest and attach a PHIUS source.
- Open PHI picker and confirm station roster appears.
- Use Find Nearest and attach a PHI source.
- Open Hourly Data and attach a OneBuilding weather file, or use manual upload
  if catalog access is unavailable.
- Verify `project_climate_source` and `project_assets` rows.

Success gate:

- PHIUS and PHI no longer show dataset-missing empty states.
- The project has one `phius`, one `phi`, and one `weather` source.
- Hourly source has a backing EPW asset in R2.

## P04 - Runbook and maintenance closeout

Detailed handoff: `phases/phase-04-runbook-and-maintenance-closeout.md`.

Tasks:

- Update this feature `STATUS.md` with date, commands, counts, and smoke
  evidence.
- Fold stable operator facts into `context/PRODUCTION_DEPLOYMENT.md` or
  `context/ENVIRONMENT.md` if current docs are missing anything.
- Record rerun policy:
  - `--no-replace` for no-op checks or first publish after partial state.
  - plain `--all` only when replacing a known release.
- Record next-source-version checklist for future PHIUS/PHI releases.

Success gate:

- The planning packet can be archived with enough evidence for another agent or
  operator to understand exactly what was run and how to rerun it safely.

## Abort conditions

Stop before production writes if any of these are true:

- R2 credentials point to the wrong bucket.
- Source parse counts are unexpectedly low, especially 24 PHIUS records from
  the dev slice.
- Production DB already has attached PHIUS/PHI project sources and the plan has
  not chosen `--no-replace`.
- Render Shell environment is missing `DATABASE_URL` or production R2 settings.
- Browser smoke would require signing in as Ed while he is actively using the
  app, unless he explicitly asks for that session handoff.
