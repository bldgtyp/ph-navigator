# Environment (PHN-V2) — agent quick-card

## Python: ALWAYS uv

- `uv run <cmd>` — run a command in the project venv
- `uv add <pkg>` / `uv add --dev <pkg>` — add a dep
- `uv sync` — install/refresh from `uv.lock`
- NEVER use `python`, `python3`, `pip`, `source .venv/bin/activate`
- Backend project root: `backend/`

## Node: pnpm only

- `pnpm install`, `pnpm run dev`, `pnpm test`, `pnpm run build`
- Frontend project root: `frontend/`
- NOT npm, NOT yarn
- Keep pnpm supply-chain protections enabled: 24-hour
  `minimumReleaseAge`, strict minimum-age enforcement, and
  `blockExoticSubdeps`.

## Database

- `docker compose up -d db` from repo root
- Local V2 Postgres publishes host `localhost:5433` to container `5432`
  so V1 can keep using host `5432`.
- `cd backend && uv run alembic upgrade head` to apply migrations

## Env files

- `backend/.env` (gitignored) — copy from `backend/.env.example`
- `frontend/.env.local` (gitignored) — copy from `frontend/.env.example`
- No second `.env`. No `.env.poc`. No overlays.
- Local backend defaults:
  - `DATABASE_URL=postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2`
  - `SESSION_COOKIE_NAME=phn_session`
  - `SESSION_LIFETIME_MINUTES=60`
  - `SESSION_COOKIE_SAMESITE=lax`
  - `PASSWORD_ARGON2_TIME_COST=3`
  - `PASSWORD_ARGON2_MEMORY_COST=65536`
  - `PASSWORD_ARGON2_PARALLELISM=4`
  - `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000`
  - `MCP_ISSUER_URL=http://localhost:8000`
  - `MCP_RESOURCE_SERVER_URL=http://localhost:8000/mcp`
  - `MCP_ENABLE_DNS_REBINDING_PROTECTION=true`
  - `MCP_ALLOWED_HOSTS=` and `MCP_ALLOWED_ORIGINS=` are optional
    comma-separated extras. The backend always derives local
    `localhost` / `127.0.0.1` hosts, deployed hosts plus wildcard-port
    variants from `MCP_*` URLs and Render's `RENDER_EXTERNAL_URL` /
    `RENDER_EXTERNAL_HOSTNAME`, and allowed origins from `MCP_*` URLs
    plus `CORS_ORIGINS`.
  - `FERNET_SECRET_KEY` is reserved for future at-rest field
    encryption; TB-01 session cookies are opaque DB row pointers, not
    signed/encrypted payload cookies.
- Split-origin staging, such as separate Render frontend/backend
  subdomains, must set `SESSION_COOKIE_SAMESITE=none` with HTTPS so the
  browser stores the API session cookie.

## Render staging

Current staging runs inside the existing Render `PH-Navigator` project
under the `Staging` environment.

- Static frontend service: `ph-navigator-v2-staging`
  - URL: `https://ph-navigator-v2-staging.onrender.com`
  - Root directory: `frontend`
  - Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm run build`
  - Publish directory: `dist`
  - Rewrite rule: `/*` -> `/index.html` with action `Rewrite`
  - Env: `VITE_API_BASE_URL=https://ph-navigator-v2.onrender.com`
- Backend web service: `ph-navigator-v2-api-staging`
  - URL: `https://ph-navigator-v2.onrender.com`
  - Root directory: `backend`
  - Build command: `pip install uv && uv sync --frozen --no-dev`
  - Start command:
    `uv run alembic upgrade head && uv run uvicorn main:app --host 0.0.0.0 --port $PORT`
  - Env:
    - `ENVIRONMENT=staging`
    - `APP_VERSION=0.1.0`
    - `DATABASE_URL=<Render internal database URL>`
    - `CORS_ORIGINS=https://ph-navigator-v2-staging.onrender.com`
    - `SESSION_COOKIE_NAME=phn_session`
    - `SESSION_LIFETIME_MINUTES=60`
    - `SESSION_COOKIE_SAMESITE=none`
    - `MCP_ISSUER_URL=https://ph-navigator-v2.onrender.com`
    - `MCP_RESOURCE_SERVER_URL=https://ph-navigator-v2.onrender.com/mcp`
    - `MCP_ENABLE_DNS_REBINDING_PROTECTION=true`
    - `MCP_ALLOWED_HOSTS=ph-navigator-v2.onrender.com`
    - `MCP_ALLOWED_ORIGINS=https://ph-navigator-v2-staging.onrender.com`
    - Render also sets `RENDER_EXTERNAL_URL` and
      `RENDER_EXTERNAL_HOSTNAME`; the backend derives MCP Host allowlist
      entries from them automatically.
    - `FERNET_SECRET_KEY=<generated Fernet key>`
- Postgres service: `ph-navigator-v2-staging-db`
  - Database: `ph_navigator_v2`
  - Runtime: PostgreSQL 16
  - Region: Ohio (US East)
  - Free instance expires on 2026-06-11 unless upgraded.

Do not copy Render database credentials into `backend/.env` for normal
local development. Local dev should keep using Docker Postgres. For a
one-time staging seed/reset from a local shell, temporarily export the
Render external database URL and staging environment:

```bash
cd backend
export DATABASE_URL='<Render External Database URL>'
export ENVIRONMENT=staging
uv run python -m scripts.seed_user --email ed@example.com --display-name "Ed May" --allow-staging
unset DATABASE_URL ENVIRONMENT
```

Let the seed script prompt for the password. If a temporary staging app
password was shared in chat or another durable channel, rotate it.

## Local auth seed

- `make seed-dev-user` creates/resets local editor
  `ed@example.com` / `password` with display name `Ed May`.
- The seed script refuses to run outside local environments
  (`development`, `test`, `local`) unless `--allow-staging` is used
  with `ENVIRONMENT=staging`.
- Backend auth tests truncate auth tables. Run `make seed-dev-user`
  after backend tests and before browser/E2E sign-in checks.

## Make recipes

- `make setup` — first-time install
- `make dev` — start Postgres; prints how to launch backend + frontend
- `make backend`, `make frontend`
- `make test`, `make typecheck`, `make lint`, `make format`,
  `make migrate`, `make smoke`
- `make seed-dev-user` — seed the local editor account for browser/E2E auth
- `make e2e` — Playwright end-to-end (frontend must be running)
- `make e2e-report` — open the last Playwright HTML report
- See `Makefile` for the full list (or `make help`).

## Coding standards

- Canonical standards: `context/CODING_STANDARDS.md`.
- Backend work must preserve the routes / models / services /
  repositories split and pass `ruff`, `ty check`, and `pytest` through
  `uv` or the Makefile.
- Frontend work must preserve feature-first organization, use TanStack
  Query for server state, and pass `build`, tests, lint, and format
  checks through `pnpm` or the Makefile.

## Browser testing (Playwright MCP)

Project-scoped MCP server registered in `.mcp.json`. Use
`mcp__plugin_playwright_playwright__*` for interactive verification
during development. Use `make e2e` for CLI test runs.
