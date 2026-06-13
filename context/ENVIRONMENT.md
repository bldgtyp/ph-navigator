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
- **Two local databases, one Postgres container:**
  - `ph_navigator_v2` — the dev database the running backend, the
    seeded dev user, and any locally-created projects live in.
  - `ph_navigator_v2_test` — the dedicated pytest database. Test
    fixtures `TRUNCATE … RESTART IDENTITY CASCADE` every table on
    every run, so this MUST stay separate from the dev DB.
- Fresh `docker compose up` (empty volume) auto-creates both DBs via
  `docker/postgres-init/`. On a pre-existing volume run
  `make db-create-test` once — it's idempotent.
- `make test-backend` runs `db-create-test` + `db-migrate-test`
  automatically and exports `DATABASE_URL=…/ph_navigator_v2_test` for
  pytest. `backend/tests/conftest.py` also pins the env var and a
  session-scoped safety-net fixture refuses to run the suite if the
  URL doesn't end in `_test`. If a future refactor breaks the
  override, the suite fails loud instead of silently truncating dev
  data.
- `make db-reset` wipes the Postgres volume — **both** dev and test
  databases are destroyed.

## Object Storage

- Local attachment development uses MinIO as an S3-compatible stand-in
  for Cloudflare R2.
- `make object-store-up` starts MinIO at `http://localhost:9000` with
  console at `http://localhost:9001`.
- `make object-store-init` creates the local
  `ph-navigator-v2-dev` bucket.
- `make dev` starts Postgres + MinIO and initializes the bucket.
- `make backend` defaults local `R2_*` values to MinIO:
  - `R2_ENDPOINT_URL=http://localhost:9000`
  - `R2_ACCESS_KEY_ID=phn_minio`
  - `R2_SECRET_ACCESS_KEY=phn_minio_local_only`
  - `R2_BUCKET=ph-navigator-v2-dev`
- Explicit shell `R2_*` values still override those Makefile defaults,
  which is how one-off Cloudflare R2 smoke tests should be run.
- MinIO CORS is configured at the service level with
  `MINIO_API_CORS_ALLOW_ORIGIN=*` for local signed PUT/GET browser
  tests. Do not copy that wildcard to Cloudflare or Render.

## Live UI access for agents

Use a single, repeatable local browser path for Codex/Claude/Playwright
inspection:

- Frontend: `http://localhost:5173`.
- Backend API: `http://localhost:8000`.
- Dedicated agent login: `codex@example.com` / `password`.

Setup/repair sequence:

```bash
make dev
make backend
make frontend
make seed-agent-user
```

Run `make backend` and `make frontend` in separate long-lived terminals.
`make frontend` should bind Vite to `5173`. If `5173` is already
responding, agents should use that server instead of starting another
one. If an agent must start Vite directly, use a strict port from
`frontend/`:

```bash
pnpm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Do not inspect the app on a Vite fallback port such as `5174` unless
the backend CORS config has also been changed. Local CORS defaults allow
`localhost:5173`, `127.0.0.1:5173`, `localhost:3000`, and
`127.0.0.1:3000`.

Before browser work, check the API:

```bash
curl -i http://localhost:8000/api/v1/auth/session
```

Expected unauthenticated response is `401` with `not_authenticated`.
That means the backend is alive and the browser should show the sign-in
page. Browser text like `SESSION CHECK FAILED` / `Failed to fetch`
means the frontend could not reach the backend, usually because the
backend is down or the frontend origin is not in CORS.

Agents should sign in with `codex@example.com` / `password`, not
`ed@example.com`, unless explicitly asked. The auth model has a
single-active-session rule per user, so logging in as Ed from an
isolated Playwright browser can invalidate the user's own live browser
session. The dedicated agent user avoids that collision while still
exercising the authenticated UI.

If the Playwright MCP browser profile is locked, use the Node REPL
Playwright fallback with `frontend/node_modules` and an isolated browser
profile. Keep the same `5173`/`8000` URLs and the same agent login.

For Model Viewer-specific browser troubleshooting (in-app Browser
clipboard/text-entry limits, restricted evaluate sandbox, HttpOnly auth
cookie constraints, and debug-hook access), read
`planning/features/model-viewer/AGENT_BROWSER_NOTES.md` before starting
manual browser verification.

### Cloudflare R2

Canonical PHN bucket plan:

- Region: **ENAM**.
- Staging/dev bucket: `ph-navigator-v2-dev`.
- Production bucket: `ph-navigator-v2-prod`.
- Public access: off. PHN uses signed PUT/GET URLs only.
- Object keys are backend-controlled:
  - `projects/{project_id}/assets/{asset_id}/file.{ext}`
  - `projects/{project_id}/assets/{asset_id}/thumb.png`
  - `projects/{project_id}/assets/_orphaned/{asset_id}/{filename}`
- Lifecycle rule: auto-delete objects under
  `projects/*/assets/_orphaned/` after 90 days.

Required R2 environment variables for Render or an opt-in real-R2
smoke test:

- `R2_ACCOUNT_ID=<Cloudflare account id>`
- `R2_ACCESS_KEY_ID=<R2 API token access key id>`
- `R2_SECRET_ACCESS_KEY=<R2 API token secret access key>`
- `R2_BUCKET=ph-navigator-v2-dev` for staging/dev, or
  `ph-navigator-v2-prod` for production
- `R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com`

Credential note: PHN uses boto3's S3-compatible client, so Render needs
the R2 token's S3-style credentials, not the Cloudflare account API
bearer token alone. In the Cloudflare dashboard, the R2 credential panel
may show four values: `Token value`, `Access Key ID`,
`Secret Access Key`, and `Account ID`. Map them this way:

- `Account ID` -> `R2_ACCOUNT_ID`
- `Access Key ID` -> `R2_ACCESS_KEY_ID`
- `Secret Access Key` -> `R2_SECRET_ACCESS_KEY`
- `Token value` -> store in 1Password for Cloudflare API/token
  management; PHN does not use it for boto3 signed upload/download URLs.

Capture these values once, then store them only in 1Password/Render.

Bucket CORS for direct browser signed uploads/downloads:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://ph-navigator-v2-staging.onrender.com"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Cloudflare dashboard setup confirmed on 2026-05-26:

- bucket `ph-navigator-v2-dev` exists for dev/staging attachment work;
- public access is disabled;
- CORS allows local Vite origins plus
  `https://ph-navigator-v2-staging.onrender.com` for `PUT`, `GET`, and
  `HEAD`;
- the default multipart abort rule is enabled after 7 days;
- a staging/dev cleanup lifecycle rule deletes objects under `projects/`
  after 90 days.

Do not store `R2_SECRET_ACCESS_KEY` in this repo. Store the R2 token in
1Password under the PH-Navigator R2 item and copy it only into Render or
an ephemeral local shell for the opt-in smoke.

## Env files

- `backend/.env` (gitignored) — copy from `backend/.env.example`
- `frontend/.env.local` (gitignored) — copy from `frontend/.env.example`
- No second `.env`. No `.env.poc`. No overlays.
- Logging-related backend env keys (see `context/LOGGING.md` for the
  full reference): `LOG_LEVEL` (default `INFO`), `LOG_FORMAT`
  (`console` locally, `json` on Render), `LOG_SQL`
  (default `false`), `LOG_SAMPLE_HEALTH` (default `false`),
  `GIT_SHA` (Render's `RENDER_GIT_COMMIT`).
- Local backend defaults:
  - `DATABASE_URL=postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2`
  - `SESSION_COOKIE_NAME=phn_session`
  - `SESSION_LIFETIME_MINUTES=60`
  - `SESSION_COOKIE_SAMESITE=lax`
  - `PASSWORD_ARGON2_TIME_COST=3`
  - `PASSWORD_ARGON2_MEMORY_COST=65536`
  - `PASSWORD_ARGON2_PARALLELISM=4`
  - `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000`
  - `R2_ENDPOINT_URL=http://localhost:9000`
  - `R2_ACCESS_KEY_ID=phn_minio`
  - `R2_SECRET_ACCESS_KEY=phn_minio_local_only`
  - `R2_BUCKET=ph-navigator-v2-dev`
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
  - Build command: `pnpm install --frozen-lockfile && pnpm run build`
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
    - `LOG_FORMAT=json`
    - `LOG_LEVEL=INFO`
    - `GIT_SHA` mapped from Render's `RENDER_GIT_COMMIT`
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
    - `R2_ACCOUNT_ID=<Cloudflare account id>`
    - `R2_ACCESS_KEY_ID=<Render secret>`
    - `R2_SECRET_ACCESS_KEY=<Render secret>`
    - `R2_BUCKET=ph-navigator-v2-dev`
    - `R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com`
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
- Backend auth tests now truncate only the `ph_navigator_v2_test`
  database — the seeded dev user in `ph_navigator_v2` survives
  `make test-backend`. Re-seed only after `make db-reset` or if you
  manually delete the dev user.

## Make recipes

- `make setup` — first-time install
- `make dev` — start Postgres + local object storage; prints how to
  launch backend + frontend
- `make backend`, `make frontend`
- `make ci` / `make check` — run the full local CI-parity gate
- `make check-backend`, `make check-frontend` — run one CI job locally
- `make frontend-dev-check` — fast frontend-only layout/UI gate; no DB,
  backend, frozen install, or full Vitest suite
- `make object-store-up`, `make object-store-init`,
  `make object-store-down`
- `make test`, `make typecheck`, `make lint`, `make format`,
  `make migrate`, `make smoke`
- `make seed-dev-user` — seed the local editor account for browser/E2E auth
- `make e2e` — Playwright end-to-end (frontend must be running)
- `make e2e-report` — open the last Playwright HTML report
- See `Makefile` for the full list (or `make help`).

## Code-change closeout gate

Every code-changing session must end with the same local gate before the
work is reported complete, committed, or opened as a PR:

```bash
make format
make ci
```

`make format` runs Ruff format for backend Python and Prettier for
frontend source. `make ci` mirrors `.github/workflows/ci.yml` in local
form:

1. backend: `uv python install 3.11`
2. backend: `uv sync --locked`
3. backend: `uv run ruff format --check .`
4. backend: `uv run ruff check .`
5. backend: `uv run ty check`
6. backend: `DATABASE_URL=..._test uv run alembic upgrade head`
7. backend: `DATABASE_URL=..._test uv run pytest`
8. frontend: `pnpm install --frozen-lockfile`
9. frontend: `pnpm run format:check`
10. frontend: `pnpm run lint`
11. frontend: `pnpm run check:all`
12. frontend: `pnpm test`
13. frontend: `pnpm run build`

Narrow commands are fine while iterating, but the final accepted state is
`make format` followed by a green `make ci`. If formatting changes files,
review the diff and rerun `make ci` after those changes.

### Fast frontend dev gate

For simple frontend layout, CSS, typography, and component-positioning
work, use:

```bash
make frontend-dev-check
```

This runs the frontend-only checks that usually catch layout/refactor
mistakes quickly:

1. frontend: `pnpm run format:check`
2. frontend: `pnpm run lint`
3. frontend: `pnpm run check:all`
4. frontend: `pnpm run build`

It intentionally skips Postgres, Alembic, backend pytest, frozen
`pnpm install`, and the full Vitest suite. If the frontend change
affects interaction, state, TanStack Query behavior, parsers, data
transforms, or adapters, add the focused Vitest command for the touched
area, for example:

```bash
cd frontend && pnpm exec vitest run src/features/.../__tests__/name.test.tsx
```

`make frontend-dev-check` is an iteration tool only. It does not replace
the required `make format` followed by `make ci` closeout gate.

## Logging

- Canonical reference: `context/LOGGING.md`.
- Backend uses `structlog` over stdlib `logging`. JSON output in
  `staging`/`production`, colorized key=value in local dev.
- Every API error response carries a `request_id` that matches the
  log lines emitted while handling it — paste it into Render's log
  search to reconstruct the request.

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
