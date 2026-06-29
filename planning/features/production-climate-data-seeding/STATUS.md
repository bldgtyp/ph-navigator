---
DATE: 2026-06-29
TIME: 17:39 EDT
STATUS: P02 complete - production Render Postgres seeded and verified; P03 is next.
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

P00 production readiness audit is complete. P01 production R2 bundle publishing
is complete. P02 production Render Postgres seeding is complete.

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
- Production R2 upload on 2026-06-29 at 17:35 EDT:
  - `uv run python -m features.climate.processing --provider phius --version 2022 --src ../planning/archive/dated/2026-06-14/climate/example_data --upload`
    processed 1007 stations and uploaded
    `climate/phius/2022/dataset.json`.
  - `uv run python -m features.climate.processing --provider phi --version 10.6 --src ../planning/archive/dated/2026-06-14/climate/example_data/phi_phpp_10_6_climate_data --upload`
    processed 1002 stations and uploaded
    `climate/phi/10.6/dataset.json`.
  - R2 HEAD verification against `ph-navigator-prod`:
    - `climate/phius/2022/dataset.json`: size `4807491`,
      content type `application/json`, ETag present.
    - `climate/phi/10.6/dataset.json`: size `4775302`,
      content type `application/json`, ETag present.
- Production seed on 2026-06-29 at 17:37 EDT:
  - Render one-off job `job-d91eb7favr4c73fgdglg` on
    `ph-navigator-api` / `srv-d909p1b7uimc7396t580`.
  - Command:
    `uv run python -m features.climate.seeding --all --no-replace`.
  - Job status: `succeeded`; started `2026-06-29T21:37:33Z`, finished
    `2026-06-29T21:38:17Z`.
  - `render psql dpg-d909olr7uimc7396sls0-a` verification:
    - `phi / 10.6 / PHI 10.6`: 1002 locations.
    - `phius / 2022 / Phius 2022`: 1007 locations.
    - `project_climate_source` for `phius`, `phi`, and `weather`: no rows yet.
  - Auxiliary Python verification job `job-d91eblq8qa3s73fu7nqg` failed, so
    the accepted SQL evidence is the direct `render psql` output above.

## Next step

Start P03: `phases/phase-03-production-ui-and-api-smoke.md`.

P02 used the chosen first production seed mode:

```bash
uv run python -m features.climate.seeding --all --no-replace
```

## Blockers

No code blocker. No current P01 blocker remains.

Later phase prerequisites:

- Permission to sign in to the production app for P03 browser smoke.

## Success gates by phase

| Phase | Required evidence |
|---|---|
| P00 | Complete: audit note with current DB/object-store state and chosen seed mode |
| P01 | Complete: R2 HEAD confirms both production bundle objects |
| P02 | Complete: production SQL counts confirm seeded provider/version rows |
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
