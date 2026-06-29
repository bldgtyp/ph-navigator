---
DATE: 2026-06-29
TIME: 17:55 EDT
STATUS: Complete decision ledger for production climate-data enablement.
AUTHOR: Codex
SCOPE: Accepted operational decisions and open questions for production climate data seeding.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
  - STATUS.md
---

# Decisions

## Accepted

### D-PCDS-1 - Production climate reference data stays private in R2

PHIUS and PHI reference data must not be committed to the public repo. The
source of truth is the private object-store bundle:

```text
climate/{provider}/{version}/dataset.json
```

### D-PCDS-2 - Process and seed remain separate operator steps

Processing raw licensed files into bundles is a rare operator step.
Seeding Postgres from already-published bundles is a separate provider-agnostic
step. Production must not parse raw PHIUS/PHI files at request time or startup.

### D-PCDS-3 - No climate seed in Render start command

Production Render startup remains:

```bash
uv run alembic upgrade head
uv run uvicorn main:app --host 0.0.0.0 --port $PORT
```

Climate seeding is on demand after a bundle is published.

### D-PCDS-4 - First production seed should prefer `--no-replace`

For the first Beta production environment, use:

```bash
uv run python -m features.climate.seeding --all --no-replace
```

This seeds missing provider/version releases without rebuilding existing rows.
Use plain `--all` only when intentionally replacing an existing release and
accepting the impact on any project sources that point at old
`climate_dataset_location.id` values.

### D-PCDS-5 - Hourly Data is verified separately from PHIUS/PHI seeding

Hourly Data is a `weather` source backed by `project_assets`, not an app-wide
`climate_dataset`. Its production gate is a weather-source attach smoke and R2
asset verification.

### D-PCDS-6 - Do not use the dev slice for production

`backend/seeds/climate` is local-dev bootstrap material only. In this checkout
it has 24 Phius `-mon.txt` files and no PHI workbook. Production publishing must
use full licensed sources.

## Resolved questions

### O-PCDS-1 - Where should final production seed evidence live?

Resolved: concise evidence is recorded in this packet's `STATUS.md`. Existing
stable runbook guidance in `context/PRODUCTION_DEPLOYMENT.md` and
`context/ENVIRONMENT.md` was sufficient; no durable context patch was required.

### O-PCDS-2 - Do we need a production admin diagnostic endpoint?

Resolved: not required for this run. SQL plus existing app UI was enough.
Consider only if operators repeatedly need a non-SQL readout of seeded climate
providers.
