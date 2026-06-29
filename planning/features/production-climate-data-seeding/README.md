---
DATE: 2026-06-29
TIME: 17:43 EDT
STATUS: Active implementation packet - P02 complete; P03 blocked on authorized production browser session.
AUTHOR: Codex
SCOPE: Production climate data enablement for the first Beta production environment: publish PHIUS/PHI reference bundles to Cloudflare R2, seed Render Postgres, and verify PHIUS, PHI, and Hourly climate workflows on www.ph-nav.com.
RELATED:
  - PRD.md
  - PLAN.md
  - STATUS.md
  - decisions.md
  - phases/
  - context/PRODUCTION_DEPLOYMENT.md
  - context/DATA_STORAGE.md
  - context/ENVIRONMENT.md
  - backend/features/climate/
  - backend/features/project_climate_source/
  - frontend/src/features/climate/
---

# Production Climate Data Seeding

## Scope

Production is live at `https://www.ph-nav.com` with API
`https://api.ph-nav.com`. The Climate tab currently shows empty PHIUS/PHI
dataset pickers because production needs the private climate reference bundles
published to Cloudflare R2 and seeded into Render Postgres.

This packet defines the operator sequence to make production Climate usable:

1. confirm production R2 and DB readiness,
2. publish full licensed PHIUS/PHI bundles to `ph-navigator-prod`,
3. seed `climate_dataset` and `climate_dataset_location`,
4. smoke PHIUS, PHI, and Hourly Data from the live app, and
5. record the runbook evidence without committing licensed source data or
   secrets.

## Critical distinction

PHIUS and PHI are app-wide static reference datasets:

```text
R2 climate/{provider}/{version}/dataset.json
  -> climate_dataset
  -> climate_dataset_location
```

Hourly Data is not a static `climate_dataset` provider. It is the project
`weather` source path: OneBuilding EPW/STAT download or manual EPW/STAT/DDY
upload, stored as `project_assets` in the same private object store.

## Read order

1. `PRD.md` - production behavior contract and data boundaries.
2. `PLAN.md` - step-by-step phase sequence.
3. `decisions.md` - accepted operational decisions and open questions.
4. `STATUS.md` - current state and next action.
5. `phases/` - detailed implementation handoffs with success gates.

## Phase map

| Phase | State | Title | Purpose | Success gate |
|---|---|---|---|---|
| P00 | Complete | Production readiness audit | Confirm Render env, R2 bucket posture, current DB state, source inputs, and rerun policy before touching production | Audit recorded in `STATUS.md`: production DB has no climate rows/sources yet; production R2 env is configured; both climate bundle keys are missing; full local sources parse cleanly |
| P01 | Complete | Publish R2 reference bundles | Build full PHIUS/PHI bundles from licensed sources and upload to `ph-navigator-prod` | R2 has `climate/phius/2022/dataset.json` and `climate/phi/10.6/dataset.json`; local parse counts are non-empty and expected |
| P02 | Complete | Seed Render Postgres | Run provider-agnostic seeder in `ph-navigator-api` Render Shell / one-off job | Production DB reports PHIUS and PHI rows with expected location counts |
| P03 | Blocked / next | Live app smoke | Verify PHIUS, PHI, and Hourly Data workflows through `www.ph-nav.com` | PHIUS/PHI pickers show stations and can attach; Hourly weather source can attach and creates R2-backed asset rows |
| P04 | Planned | Runbook closeout | Fold evidence and rerun rules into durable docs | STATUS and production runbook record exact date, counts, commands, and any follow-up |

## Local evidence already gathered

Read-only parsing of current local source candidates succeeded:

- `phius` version `2022`: 1007 records.
- `phi` version `10.6`: 1002 records.

`backend/seeds/climate` is not a production source. It currently contains only
a small dev Phius slice: 24 `-mon.txt` files and no PHI workbook.

Production R2 upload evidence from P01:

- `climate/phius/2022/dataset.json`: uploaded from the full PHIUS source,
  1007 records, HEAD size `4807491`, content type `application/json`.
- `climate/phi/10.6/dataset.json`: uploaded from the full PHI source,
  1002 records, HEAD size `4775302`, content type `application/json`.

Production DB seed evidence from P02:

- Render one-off job `job-d91eb7favr4c73fgdglg` succeeded with
  `uv run python -m features.climate.seeding --all --no-replace`.
- `phi / 10.6 / PHI 10.6`: 1002 locations.
- `phius / 2022 / Phius 2022`: 1007 locations.
- `project_climate_source` still has no `phius`, `phi`, or `weather` rows;
  those are expected to appear during P03 live app smoke.

## Out of scope

- Adding a new climate provider or schema version.
- Making climate seeding part of the Render start command.
- Committing PHIUS, PHI, PHPP, WUFI, or other licensed climate data to this
  public repo.
- Replacing the OneBuilding Hourly weather-source path with a static hosted
  hourly bundle.
