---
DATE: 2026-06-29
TIME: 16:56 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Audit production state before any climate-data writes.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ../STATUS.md
  - context/PRODUCTION_DEPLOYMENT.md
  - context/ENVIRONMENT.md
---

# Phase 00 - Production Readiness Audit

## Outcome

Complete on 2026-06-29.

No production DB or R2 writes were performed.

Evidence:

- Render CLI authenticated as Ed May / `phtools@bldgtyp.com`.
- Current production resources:
  - API: `ph-navigator-api`, `srv-d909p1b7uimc7396t580`, root `backend`.
  - Frontend: `ph-navigator-web`, `srv-d909olr7uimc7396slr0`, root `frontend`.
  - DB: `ph-navigator-db`, `dpg-d909olr7uimc7396sls0-a`,
    database `ph_navigator_74vs`.
- Production DB read-only SQL:
  - `climate_dataset`: empty.
  - `project_climate_source` for `phius`, `phi`, `weather`: empty.
- Production API env/R2 read-only job:
  - Job `job-d91dn5bsq97s73clp4i0`, status `succeeded`.
  - `ENVIRONMENT=production`.
  - `R2_BUCKET=ph-navigator-prod`.
  - `R2_ENDPOINT_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
    `R2_SECRET_ACCESS_KEY`, and `DATABASE_URL` are present.
  - `climate/phius/2022/dataset.json`: missing.
  - `climate/phi/10.6/dataset.json`: missing.
- Local source parse:
  - PHIUS 2022 full candidate source: 1007 records.
  - PHI 10.6 full candidate source: 1002 records.
  - `backend/seeds/climate`: 24 Phius files and 0 PHI workbooks; not a
    production source.
- Cloudflare R2 read-only API audit:
  - Bucket `ph-navigator-prod` exists; creation date
    `2026-06-28T03:15:47.896Z`, location `ENAM`, storage class `Standard`.
  - Managed public `r2.dev` domain is disabled.
  - CORS allows `https://www.ph-nav.com` and `https://ph-nav.com` for
    `GET`, `HEAD`, and `PUT`; exposed header is `ETag`.
  - Listing prefix `climate/` returns no objects.
- Chosen P02 seed mode after P01 upload:

  ```bash
  uv run python -m features.climate.seeding --all --no-replace
  ```

Reason: production has no climate datasets and no PHIUS/PHI/weather project
sources yet, so first seed can safely leave any existing releases untouched.

## Goal

Confirm the target environment, source inputs, current database state, and seed
mode before publishing or seeding anything.

## Preconditions

- Operator has Render access to `ph-navigator-api` and `ph-navigator-db`.
- Operator has Cloudflare R2 S3 credentials for PH-Navigator.
- Operator has local access to the full licensed PHIUS and PHI source inputs.
- No production R2 or DB write is performed in this phase.

## Steps

1. Confirm production service identity:
   - API service: `ph-navigator-api`.
   - Frontend: `ph-navigator-web`.
   - DB: `ph-navigator-db`.
   - R2 bucket: `ph-navigator-prod`.

2. Confirm Render env:
   - `ENVIRONMENT=production`.
   - `R2_BUCKET=ph-navigator-prod`.
   - `R2_ACCOUNT_ID` present.
   - `R2_ENDPOINT_URL` present.
   - `R2_ACCESS_KEY_ID` present.
   - `R2_SECRET_ACCESS_KEY` present.
   - `DATABASE_URL` wired from Render DB.

3. Confirm R2 posture:
   - Public `r2.dev` access disabled.
   - CORS allows `https://www.ph-nav.com` and `https://ph-nav.com` for
     `PUT`, `GET`, and `HEAD`.
   - Existing climate keys, if any, are listed:
     - `climate/phius/2022/dataset.json`
     - `climate/phi/10.6/dataset.json`

4. Confirm production DB state with read-only SQL:

   ```sql
   SELECT d.provider, d.version, count(l.id) AS locations
   FROM climate_dataset d
   LEFT JOIN climate_dataset_location l ON l.dataset_id = d.id
   GROUP BY d.provider, d.version
   ORDER BY d.provider, d.version;
   ```

   ```sql
   SELECT kind, count(*) AS sources
   FROM project_climate_source
   WHERE kind IN ('phius', 'phi', 'weather')
   GROUP BY kind
   ORDER BY kind;
   ```

5. Re-run local read-only source parse from `backend/`:

   ```bash
   uv run python -c "from pathlib import Path; from features.climate.processing import build_bundle; b=build_bundle('phius','2022',Path('../planning/archive/dated/2026-06-14/climate/example_data')); print(len(b.records))"
   uv run python -c "from pathlib import Path; from features.climate.processing import build_bundle; b=build_bundle('phi','10.6',Path('../planning/archive/dated/2026-06-14/climate/example_data/phi_phpp_10_6_climate_data')); print(len(b.records))"
   ```

6. Decide seed mode:
   - Use `--no-replace` if production rows are absent or partial and we want to
     avoid rebuilding existing rows.
   - Use plain `--all` only if intentionally replacing existing releases.

## Success gate

Record an audit note with:

- Render service and bucket confirmed.
- R2 object state before upload.
- Current DB counts.
- Current project source counts.
- PHIUS and PHI parse counts.
- Chosen seed command.

Do not proceed to P01 if PHIUS parse count is 24; that indicates the dev slice
was selected instead of the full source.

Status: passed. Proceed to P01 once local production R2 credentials are
available to the operator shell.

## Rollback

No rollback needed. This phase is read-only.
