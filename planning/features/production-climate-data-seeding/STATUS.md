---
DATE: 2026-06-29
TIME: 16:56 EDT
STATUS: P00 complete - production readiness audit recorded; P01 blocked on local production R2 credentials for bundle upload.
AUTHOR: Codex
SCOPE: Current state and next step for production climate data enablement.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
  - decisions.md
  - phases/
---

# Production Climate Data Seeding - Status

## Current state

P00 production readiness audit is complete. No production DB or R2 writes have
been performed in this session.

Current code/docs already support the target workflow:

- R2 climate bundle namespace:
  `climate/{provider}/{version}/dataset.json`.
- Process CLI:
  `uv run python -m features.climate.processing --provider ... --upload`.
- Seed CLI:
  `uv run python -m features.climate.seeding --all`.
- Production runbook says run the seeder from the `ph-navigator-api` Render
  environment, not from the Render start command.
- Frontend PHIUS/PHI picker empty state maps to backend `dataset=null`.
- Hourly Data uses the project `weather` source path, not `climate_dataset`.

Read-only checks completed:

- PHIUS 2022 full candidate source parses to 1007 records.
- PHI 10.6 full candidate source parses to 1002 records.
- `backend/seeds/climate` contains 24 Phius files and no PHI workbook; it must
  not be used as the production source.
- Render CLI is authenticated as Ed May / `phtools@bldgtyp.com`.
- Current production resources confirmed:
  - API: `ph-navigator-api`, `srv-d909p1b7uimc7396t580`, root `backend`.
  - Frontend: `ph-navigator-web`, `srv-d909olr7uimc7396slr0`, root `frontend`.
  - DB: `ph-navigator-db`, `dpg-d909olr7uimc7396sls0-a`,
    database `ph_navigator_74vs`.
- Production DB aggregate counts:
  - `climate_dataset`: no provider/version rows.
  - `project_climate_source` for `phius`, `phi`, `weather`: no rows.
- Read-only Render one-off env/R2 audit job:
  - Job: `job-d91dn5bsq97s73clp4i0`, status `succeeded`.
  - `ENVIRONMENT=production`.
  - `R2_BUCKET=ph-navigator-prod`.
  - `R2_ENDPOINT_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
    `R2_SECRET_ACCESS_KEY`, and `DATABASE_URL` are all present in the service
    environment.
  - `climate/phius/2022/dataset.json`: missing.
  - `climate/phi/10.6/dataset.json`: missing.
- Cloudflare R2 read-only API audit:
  - Bucket `ph-navigator-prod` exists; creation date
    `2026-06-28T03:15:47.896Z`, location `ENAM`, storage class `Standard`.
  - Managed public `r2.dev` domain is disabled.
  - CORS allows `https://www.ph-nav.com` and `https://ph-nav.com` for
    `GET`, `HEAD`, and `PUT`; exposed header is `ETag`.
  - Listing prefix `climate/` returns no objects.

## Next step

Start P01: `phases/phase-01-publish-r2-reference-bundles.md`.

The operator must publish both full bundles to `ph-navigator-prod` before P02:

- `climate/phius/2022/dataset.json`.
- `climate/phi/10.6/dataset.json`.

Chosen P02 seed mode after upload:

```bash
uv run python -m features.climate.seeding --all --no-replace
```

This is the correct first production seed mode because production currently has
no `climate_dataset` rows and no PHIUS/PHI/weather project sources.

## Blockers

No code blocker. Operational blockers remain for P01:

- Access to PH-Navigator R2 S3 credentials.
- A local operator shell with those R2 credentials exported, because the full
  licensed source files are local and are not available inside the Render
  service image.

Later phase prerequisites:

- Render Shell or one-off Job for `ph-navigator-api` is available for P02.
- Permission to sign in to the production app for P03 browser smoke.

## Success gates by phase

| Phase | Required evidence |
|---|---|
| P00 | Complete: audit note with current DB/object-store state and chosen seed mode |
| P01 | R2 HEAD/list confirms both production bundle objects |
| P02 | Production SQL counts confirm seeded provider/version rows |
| P03 | Live app screenshot/log notes confirm PHIUS, PHI, and Hourly attach workflows |
| P04 | Runbook and this status file updated with exact date, counts, commands, and follow-ups |

## Verification performed for this docs packet

- Planning instructions read.
- Climate production docs, data storage docs, seeding code, processing code,
  project source service, frontend picker empty state, and local source counts
  were reviewed before drafting.
- Production Render DB, Render service env, and Cloudflare R2 state were
  checked read-only on 2026-06-29.
- Runtime production seeding has not been run.
