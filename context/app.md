# App Structure & Context Guide

## 1. Purpose & Domain

Web-Dashboard for Passive House project data.

## 2. High-Level Architecture

- Monorepo (frontend, backend)
- Interaction model: SPA frontend (React) → REST API (FastAPI) → PostgreSQL (Render.com)
- Outside datasource / connection: AirTable (https://www.airtable.com)

## 3. Tech Stack Overview

| Layer            | Tech                           | Notes                                                   |
| ---------------- | ------------------------------ | ------------------------------------------------------- |
| Frontend         | React + TypeScript + MUI       | DataGrid heavy usage, custom hooks, context for units   |
| State            | React Context + Hooks          | (User, UnitSystem, Apertures, FrameTypes, GlazingTypes) |
| Backend          | FastAPI (Python 3.11)          | Services + schemas + db_entities separation             |
| ORM              | SQLAlchemy + Alembic           | Explicit services layer mediates access                 |
| DB (Production)  | PostgreSQL (Render.com hosted) |                                                         |
| DB (Development) | PostgreSQL (local Docker)      |                                                         |
| DB (Testing)     | SQLite (local testing)         |                                                         |
| Auth             | JWT                            | see: backend/features/auth/services.py                  |
| Packaging        | NA                             |                                                         |
| Tooling          | ESLint, Prettier, TypeScript   |
| Testing          | Backend: Pytest                |
| Deployment       | GitHub / Render.com            | https://www.ph-nav.com                                  |

## 4. Repository Layout

# App Structure – Top-Level Folders

```
ph-navigator/
├─ backend/
├─ frontend/
├─ context/
├─ .github/
└─ README.md
```

## Folder Descriptions

- backend/  
  FastAPI + SQLAlchemy backend. Contains:

  - db_entities (ORM models)
  - features (domain modules: services, schemas, routes)
  - alembic (migrations)
  - tests (backend tests)

- frontend/  
  React + TypeScript SPA. Feature‑first structure:

  - src/features/... (contexts, hooks, DataGrids)
  - shared components, theming, assets

- context/  
  Documentation for developers & LLMs (architecture, conventions, domain notes).

- .github/ (optional)  
  GitHub Actions workflows, issue/PR templates.

- README.md  
  Entry point overview, quick start

## 5. Deployment & Environments

This app is deployed on Render.com at https://www.ph-nav.com. Frontend (React SPA) and backend (FastAPI) communicate over REST. All persistence uses PostgreSQL in production; local development uses PostgreSQL in a local Docker container, testing uses SQLite in-memory (overrideable).

### 5.1 Configuration Management (Backend)

Configuration centralizes in backend/config.py via a Pydantic `Settings` class. It reads from environment variables (and `.env` in local dev). Access config through the imported `settings` object—do not hardcode literals elsewhere.

Key fields (see config.py):

- JSON_WEB_TOKEN_SECRET_KEY / JSON_WEB_TOKEN_ALGORITHM / JSON_WEB_TOKEN_EXPIRE_MINUTES
- DATABASE_URL (override in prod with Postgres; default points to `sqlite:///./test.db`)
- CORS_ORIGINS (whitelist for frontend hosts)
- AIRTABLE\_\* (Base IDs, Table IDs, PAT tokens for external data sync)
- FERNET_SECRET_KEY (used to encrypt/decrypt Airtable PATs)
- GCP_BUCKET_NAME (file/object storage target)

### 5.2 Local Development

1. Create `backend/.env` (never commit):
   ```
   JSON_WEB_TOKEN_SECRET_KEY=dev_generated_key
   DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/ph_nav_dev
   AIRTABLE_MATERIAL_BASE_ID=...
   AIRTABLE_MATERIAL_TABLE_ID=...
   AIRTABLE_MATERIAL_GET_TOKEN=...
   AIRTABLE_APERTURE_DATA_BASE_ID=...
   AIRTABLE_FRAME_DATA_TABLE_ID=...
   AIRTABLE_GLAZING_DATA_TABLE_ID=...
   AIRTABLE_APERTURE_DATA_GET_TOKEN=...
   FERNET_SECRET_KEY=<output of Fernet.generate_key()>
   GCP_BUCKET_NAME=dev-bucket
   ```
2. Run Postgres (e.g. docker-compose) or keep SQLite (no env change needed).
3. Alembic migrations: `alembic upgrade head`.
4. Start backend: `uvicorn main:app --reload`.
5. Start frontend: `npm start` (or `yarn start`).

### 5.3 Production (Render.com)

- Hosted on GitHub (https://github.com/bldgtyp/ph-navigator)
- Automatic deploy to Render.com on PR merge
- Render Dashboard: configure environment variables under the Service > Settings > Environment.
- Do not upload `.env` to production; rely on Render’s secret manager.
- `DATABASE_URL` points to managed Postgres (Render-provided connection string).
- Rotate secrets (JWT, PAT tokens, Fernet key) via Render secrets; redeploy triggers reload.

### 5.4 Secret Handling

- All secrets must exist only in environment (Render secrets / local `.env`).
- Encryption of Airtable tokens: raw token stored encrypted using `FERNET_SECRET_KEY`; decrypt only in service layer where required.
- Never log secrets; logging statements wrap IDs but exclude tokens.
- Key rotation: generate new Fernet key and re-encrypt stored tokens; redeploy.

### 5.5 Environments Summary

| Aspect          | Dev (Local)                                   | Prod (Render)                              |
| --------------- | --------------------------------------------- | ------------------------------------------ |
| DB              | SQLite (default) or local Postgres            | Managed Postgres                           |
| Config Source   | `.env` + shell env                            | Render secrets                             |
| URL             | http://localhost:8000 (API), :3000 (frontend) | https://www.ph-nav.com                     |
| CORS            | Localhost entries                             | Public domain + GitHub Pages mirrors       |
| Migrations      | Manual (`alembic upgrade head`)               | On deploy (build script or manual trigger) |
| Airtable Tokens | Plain in `.env` (dev only)                    | Encrypted at rest, decrypted at runtime    |

### 5.6 Adding a New Config Variable

1. Add field to `Settings` in `config.py` with a sensible default or mark required.
2. Add variable to `.env.example` (create if missing) without real secret values.
3. Update Render service secrets with the new key.
4. Reference via `settings.MY_VAR` only—avoid `os.getenv` elsewhere.
5. If sensitive, confirm not accidentally logged.

### 5.7 LLM Guidance (Deployment Tasks)

When asking an LLM to modify deployment or config:

- Provide `config.py` excerpt and target change.
- Specify environment(s) impacted.
- Request both code diff and migration steps (if DB URL or new secrets).
- Confirm if variable requires encryption or rotation plan.

## 6. Refer to:

- `context/frontend.md`: High level description of the React frontend
- `context/backend.md`: High level description of the FastAPI backend
- `context/database.md`: High level description of the Databases used
