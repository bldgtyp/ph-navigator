# Project Guide for Claude — PH-Navigator V2

## Project

PH-Navigator V2 is a webapp for viewing and managing project data for
Passive House buildings during design. Rebuild of V1 around a JSON-document
data model with versioned, immutable-by-discipline saves. V1
(`../ph-navigator/`) continues to run; V2 is a parallel fresh-start build.

## Status

**Planning / scaffold.** No feature code yet. The `context/` folder
holds the canonical reference docs; `docs/plans/` holds transient
reviews / phasing; `research/` holds POC artifacts from V1's catalog
spike as precedent.

## Project Structure

- `/backend` — FastAPI server, raw SQL repositories, Alembic migrations
- `/frontend` — Vite + React + TypeScript app
- `/context` — **Read this first.** Canonical PRD + stable reference docs
- `/research` — POC artifacts kept as precedent (NOT on the import path)
- `/docs` — dated plans, reviews, and removed-doc routing

Start here in `context/`:
- `README.md` — reading order and doc routing
- `ENVIRONMENT.md` — how this dev environment is set up
- `PRD.md` — canonical V2 architecture PRD
- `TECH_STACK.md` — pinned stack decisions
- `GLOSSARY.md` — canonical product/domain vocabulary
- `USER_STORIES.md`, `UI_UX.md`, `DATA_TABLE.md` — load on demand

## Python — ALWAYS use `uv`

- **NEVER** use `python`, `python3`, `pip`, `pip3`, or
  `source .venv/bin/activate`. Use `uv run <cmd>` for commands inside the
  project venv, or `uvx <tool>` for one-shot tool runs.
- **NEVER** install packages with `pip`. Use `uv add <pkg>` (runtime) or
  `uv add --dev <pkg>` (dev). This updates `pyproject.toml` and `uv.lock`
  together.
- **NEVER** edit `uv.lock` by hand. Regenerate via `uv sync` or `uv lock`.
- Backend project root: `backend/`. uv finds `pyproject.toml` upward from
  the cwd — simplest rule: `cd backend && uv run …`.
- Python version: 3.11 (pinned by `.python-version`).
- Pydantic v2 only: `ConfigDict`, `field_validator`, `model_validator`,
  `.model_validate()`, `.model_dump()` — no v1 syntax.
- All calculations and data manipulation live in the backend. Frontend is
  display + user-interaction only.
- Persistence is raw parameterized SQL through narrow repository modules.
  No SQLAlchemy ORM/Core in app code; Alembic may use SQLAlchemy
  internally for migrations only.

## Node — npm only

- `npm install`, `npm run dev`, `npm test`, `npm run build`.
- Frontend project root: `frontend/`.
- NOT yarn, NOT pnpm.
- Run Prettier (`npm run format`) after frontend changes.

## Database

- Postgres 16 in Docker, started with `docker compose up -d db` from the
  repo root.
- Migrations via Alembic: `cd backend && uv run alembic upgrade head`.
- Never run `psql` against a system Postgres install.

## Env files

- `backend/.env` — gitignored, real secrets. Copy from `backend/.env.example`.
- `frontend/.env.local` — gitignored. Copy from `frontend/.env.example` when
  needed.
- **No second `.env`. No `.env.poc`. No overlays.** Feature flags live as
  `Settings` fields with safe defaults.

## Make recipes

- `make setup` — first-time install
- `make dev` — bring Postgres up; prints how to launch backend + frontend
- `make backend`, `make frontend`
- `make test`, `make lint`, `make format`, `make migrate`, `make smoke`
- `make e2e` — Playwright end-to-end (frontend must be running)
- See `Makefile` for the full list (or `make help`).

If you arrive in an unfamiliar repo state, **`make smoke` first.**

## Testing UIs — Playwright MCP

Playwright MCP is wired into this project (`.mcp.json` + the
`webapp-testing` skill). Use it to drive the frontend in a real browser
during development:

- `mcp__plugin_playwright_playwright__browser_navigate` etc.
- Take screenshots, snapshot the DOM, inspect console + network.

Manual `playwright` CLI tests live under `frontend/tests/e2e/` and run via
`make e2e`. Use these for regression-level tests; use the MCP for
interactive verification.

## Planning

- Durable description docs live in `context/`.
- In-progress plans, reviews, and implementation phasing live under
  `docs/plans/<YYYY-MM-DD>/...`.
- When generating a plan, add `DATE` and `TIME` headers at the top.
- Removed / superseded planning material is routed through
  `docs/REMOVED.md`.

## New Code

- Re-use existing functions, classes, and types where possible.
- Match the design patterns of existing code.
- Prioritize cleanliness and consistency over speed. Read before
  writing.
- All calculations live in the backend; the frontend displays only.

## Things to avoid

- Don't touch `../ph-navigator/` (V1). V2 is fully independent.
- Don't import from `research/` — those files are precedent and would
  not survive a typecheck against V2's dependencies. Reference them
  by reading; rewrite into `backend/` or `frontend/src/` if you need
  the code.
- Don't add `requirements.txt`. Deps live in `pyproject.toml` + `uv.lock`.
- Don't add a global `psql`, `redis-cli`, etc. install dance to the
  setup recipe — everything we need is either in `pyproject.toml`,
  `package.json`, or `docker-compose.yml`.
