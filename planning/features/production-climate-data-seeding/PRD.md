---
DATE: 2026-06-29
TIME: 16:38 EDT
STATUS: Draft production operations contract for climate-data enablement.
AUTHOR: Codex
SCOPE: Product and infrastructure behavior for production PHIUS, PHI, and Hourly climate data.
RELATED:
  - README.md
  - PLAN.md
  - STATUS.md
  - context/DATA_STORAGE.md
  - context/PRODUCTION_DEPLOYMENT.md
  - context/ENVIRONMENT.md
---

# Production Climate Data Seeding - PRD

## 1. Goal

Make the first Beta production environment fully usable for Climate workflows:

- PHIUS picker finds and attaches a seeded Phius reference station.
- PHI picker finds and attaches a seeded PHI / PHPP reference dataset.
- Hourly Data picker attaches a weather file source through the existing
  OneBuilding EPW/STAT path or manual upload path.

The result is not a new user-facing feature. It is a production data and
operations enablement sequence for existing code.

## 2. User-visible behavior

Before seeding, the PHIUS/PHI modals can correctly show:

```text
No Phius dataset is available yet.
No PHI dataset is available yet.
```

After seeding:

- The PHIUS modal lists stations for the project state by default, supports
  Find Nearest, shows backend-computed distance and elevation delta, and can
  attach or replace the project `phius` climate source.
- The PHI modal behaves the same way for `kind="phi"`, with advisory proximity
  semantics.
- The Climate source sidebar moves PHIUS/PHI from `NOT SET` to an attached
  source with provider/version metadata.
- Hourly Data can attach a `weather` source from OneBuilding or upload, storing
  EPW/STAT/DDY bytes as project assets in R2.

## 3. Data contract

### 3.1 PHIUS / PHI reference data

PHIUS and PHI are app-wide static libraries. Their source of truth is a private
object-store bundle:

```text
climate/{provider}/{version}/dataset.json
```

The bundle is a `ClimateBundle`:

- `kind="climate_dataset"`
- `schema_version=1`
- `provider`
- `version`
- `label`
- `source`
- `records[]` as standardized `ClimateRecord`

The seed step reads the bundle and writes:

- `climate_dataset`: one row per `(provider, version)`.
- `climate_dataset_location`: one row per station/dataset location, with
  searchable summary columns and full `ClimateRecord` in `data` JSONB.

### 3.2 Project climate sources

Project-selected climate bases live in `project_climate_source`:

| Kind | Ref points at | Data payload |
|---|---|---|
| `phius` | `climate_dataset_location.id` text | Server-computed proximity, dataset identity, location identity |
| `phi` | `climate_dataset_location.id` text | Server-computed proximity/advisory payload |
| `weather` | `project_assets.id` text | EPW/STAT/DDY metadata, STAT metrics, design conditions |
| `custom` | null | Inline custom `ClimateRecord` |

The PHIUS/PHI refs are text, not hard foreign keys. Existing project sources can
tolerate stale refs after a replace-style reseed because their cached source
payload remains readable, but new attach/update paths validate against live
dataset locations.

### 3.3 Hourly Data

Hourly Data is not seeded by `features.climate.seeding`. It uses:

- `GET /api/v1/projects/{pid}/climate/epw-roster` for OneBuilding station
  browsing.
- `POST /api/v1/projects/{pid}/climate/sources/weather/from-catalog` for
  OneBuilding download + parse + store.
- `POST /api/v1/projects/{pid}/climate/sources/weather/from-upload` for manual
  EPW/STAT/DDY assets.

Success for Hourly is therefore an R2 asset/write smoke, not a
`climate_dataset` row count.

## 4. Production environment contract

Production services:

- Frontend: `ph-navigator-web` at `https://www.ph-nav.com`.
- API: `ph-navigator-api` at `https://api.ph-nav.com`.
- DB: Render Postgres `ph-navigator-db`.
- R2 bucket: `ph-navigator-prod`.

Production object-store posture:

- Private bucket.
- Public `r2.dev` access disabled.
- Browser CORS allows only `https://www.ph-nav.com` and
  `https://ph-nav.com` for `PUT`, `GET`, and `HEAD`.
- Backend key namespace includes:
  - `climate/{provider}/{version}/dataset.json`
  - `projects/{project_id}/assets/{asset_id}/file.{ext}`

## 5. Source inputs

Production must use full licensed source inputs, not the dev slice.

Current local parse candidates:

- PHIUS 2022 raw tree:
  `planning/archive/dated/2026-06-14/climate/example_data`
- PHI / PHPP 10.6 workbook directory:
  `planning/archive/dated/2026-06-14/climate/example_data/phi_phpp_10_6_climate_data`

Read-only parse evidence:

- PHIUS 2022: 1007 records.
- PHI 10.6: 1002 records.

Guardrail: `backend/seeds/climate` is a local-dev seed source only. It contains
24 Phius files and no PHI workbook in this checkout.

## 6. Seeding behavior

Use the two-stage pipeline:

1. Process: `features.climate.processing`
   - Parses provider-specific raw source.
   - Produces a provider-agnostic `ClimateBundle`.
   - Uploads to R2 when `--upload` is passed.
2. Seed: `features.climate.seeding`
   - Reads already-published R2 bundles.
   - Upserts Postgres rows.
   - `--all` walks the provider registry and seeds each published default
     provider/version.

The seed command is idempotent. Default behavior replaces an existing
provider/version; `--no-replace` leaves existing releases untouched.

For first production seed, prefer:

```bash
uv run python -m features.climate.seeding --all --no-replace
```

Use plain `--all` only when intentionally rebuilding existing production
dataset rows.

## 7. Success definition

Production Climate is ready when:

- R2 contains PHIUS and PHI bundles under the production climate namespace.
- Render Postgres has `climate_dataset` rows for `phius/2022` and `phi/10.6`.
- Location counts match the accepted source parse counts or are explicitly
  explained in the audit.
- PHIUS and PHI modals no longer show the unseeded dataset message.
- An editor can attach PHIUS and PHI sources to a production project.
- An editor can attach an Hourly `weather` source, and the backing EPW asset is
  stored in R2 and registered in `project_assets`.
- The production runbook records the exact commands, date, counts, seed mode,
  and any follow-up.

## 8. Non-goals

- No automatic seeding in the Render start command.
- No committed production secrets, DB URLs, R2 account IDs, R2 access keys, or
  licensed climate data.
- No local dev command should point at `ph-navigator-prod` except a deliberate,
  time-boxed operator run.
- No change to the existing OneBuilding Hourly source architecture.
