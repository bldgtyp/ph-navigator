# PH-Navigator

The current PH-Navigator web app for viewing and managing Passive House project
data. It is the JSON-document / versioned-save rebuild that became the
canonical `bldgtyp/ph-navigator` repo during the 2026-06 production rollout.
The legacy app is preserved as V0 in `bldgtyp/ph-navigator_v0` and remains
available at `https://v0.ph-nav.com`.

**Status:** production is live at `https://www.ph-nav.com`, with the API at
`https://api.ph-nav.com`. Some historical planning and requirements docs still
use "V2" to refer to the rewrite generation.

Production deployment details are centralized in
`context/PRODUCTION_DEPLOYMENT.md`. Development and deploy workflow rules live in
`context/DEVELOPMENT_WORKFLOW.md`; ordinary work should happen on feature
branches because `main` deploys production on Render.

## Quickstart (one-time)

```bash
# 1. Backend: install Python 3.11 (via uv) and sync deps
cd backend && uv python install 3.11 && uv sync && cd ..

# 2. Frontend: install Node deps
cd frontend && pnpm install && cd ..

# 3. Copy env templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 4. Start Postgres
docker compose up -d db

# 5. Apply migrations (no-op until first migration lands)
cd backend && uv run alembic upgrade head && cd ..

# 6. Smoke-test
make smoke
```

Daily:

```bash
make dev         # bring Postgres up; prints next steps
make backend     # FastAPI on http://localhost:8000
make frontend    # Vite on http://localhost:5173
```

See `Makefile` (`make help`) for the full recipe list.

## Where things live

| Path | Purpose |
|---|---|
| `backend/` | FastAPI server, raw SQL repositories, Alembic migrations |
| `frontend/` | Vite + React + TypeScript app |
| `context/` | **Read this first.** Canonical PRD and stable reference docs |
| `research/` | POC artifacts from the legacy app's catalog spike (precedent only — not on import path) |
| `planning/` | Feature PRDs, phase plans, status ledgers, reviews, and planning archives |
| `docs/` | Stable supporting docs that do not belong in startup context |
| `working/` | Gitignored local scratch for handoffs, logs, screenshots, and temporary notes |
| `Makefile` | Discoverability layer — every command an agent needs |
| `docker-compose.yml` | Postgres (local dev only) |
| `CLAUDE.md` / `AGENTS.md` | Agent rules — Python via `uv` only, etc. |

## Rules-of-the-road for LLM agents

1. **Python:** `uv run …` or `uvx …`. Never `python`, `pip`, or
   `source .venv/bin/activate`.
2. **Node:** `pnpm` only. No npm / yarn.
3. **Database:** Postgres in Docker via `docker compose`. No system
   `psql`.
4. **Env files:** `backend/.env` and `frontend/.env.local`. No
   overlays, no `.env.poc`.
5. **Branches/deploys:** feature branches by default; merge to `main` only when
   ready for a production Render deploy.
6. **Testing UIs:** Playwright MCP (`mcp__plugin_playwright_playwright__*`)
   is available; use it to drive the frontend in a browser.

Full rules: `CLAUDE.md`, `AGENTS.md`, `context/ENVIRONMENT.md`.
