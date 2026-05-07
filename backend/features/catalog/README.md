# Catalog POC

Sandbox for the Native Catalog Manager, isolated per PRD §13.1.

- PRD: `docs/features/2026-05-06-native-catalog-manager.md`
- Active phase checklist: `docs/plans/2026-05-06/airtable-parity-phases.md`
- Baseline setup + post-gate blocks: `docs/plans/2026-05-06/catalog-poc-plan.md`
- Branch: `poc/catalog`

## Local setup

1. **Database**. Postgres must be up via the existing compose file:

    ```sh
    docker compose -f backend/docker-compose.yml up -d db
    backend/scripts/create_poc_db.sh
    ```

    This creates a second database (`ph_navigator_catalog_poc`) on the same
    container as the main PHN dev DB. They share nothing.

2. **Environment**. Copy `backend/.env.poc.example` to `backend/.env.poc` and
    fill in R2 credentials (see plan §3.0). `.env.poc` is gitignored.

3. **Run the backend with the POC flag on**:

    ```sh
    cd backend
    set -a && source .env && source .env.poc && set +a
    .venv/bin/uvicorn main:app --reload
    ```

    The catalog router only mounts when `CATALOG_POC_ENABLED=true`. With the
    flag off, `/api/catalog-poc/*` returns 404.

4. **Smoke test**:

    ```sh
    curl http://localhost:8000/api/catalog-poc/ping
    # {"status":"ok","module":"catalog-poc"}
    ```

5. **Frontend**. Visit `http://localhost:3000/catalog-poc`. Not linked from
    main nav — open the URL directly.

## Isolation rules

- Code in this package may **not** import from any other `features.<x>`
  module, and nothing outside may import from `features.catalog`. Enforced by
  `backend/tests/test_catalog_isolation.py`.
- The catalog POC writes to `ph_navigator_catalog_poc` only; never to the
  main PHN DB.
- Object storage uses the dedicated R2 bucket `ph-data-poc`.

## Layout

```
features/catalog/
  __init__.py
  routes.py           # /api/catalog-poc/...
  models/             # SQLAlchemy (week 2)
  schemas/            # Pydantic (week 2)
  migrations/         # Alembic env (week 2)
  poc_seeds/
    airtable_export/  # CSVs + downloaded attachments (gitignored)
```
