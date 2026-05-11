# PH-Navigator V2

A JSON-document / versioned-save rebuild of PH-Navigator's project
layer. The catalog stays relational (curated starting library). V1
(`../ph-navigator/`) continues to run untouched; V2 is a fresh-start
sibling, not a migration in place.

**Status:** planning / scaffold. No feature code yet. See
`context/PRD.md` for the canonical PRD.

## Quickstart (one-time)

```bash
# 1. Backend: install Python 3.11 (via uv) and sync deps
cd backend && uv python install 3.11 && uv sync && cd ..

# 2. Frontend: install Node deps
cd frontend && npm install && cd ..

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
| `research/` | POC artifacts from V1's catalog spike (precedent only — not on import path) |
| `docs/plans/` | Dated reviews, phasing, and in-progress plans |
| `docs/REMOVED.md` | Removed / archived planning-doc routing |
| `Makefile` | Discoverability layer — every command an agent needs |
| `docker-compose.yml` | Postgres (local dev only) |
| `CLAUDE.md` / `AGENTS.md` | Agent rules — Python via `uv` only, etc. |

## Rules-of-the-road for LLM agents

1. **Python:** `uv run …` or `uvx …`. Never `python`, `pip`, or
   `source .venv/bin/activate`.
2. **Node:** `npm` only. No yarn / pnpm.
3. **Database:** Postgres in Docker via `docker compose`. No system
   `psql`.
4. **Env files:** `backend/.env` and `frontend/.env.local`. No
   overlays, no `.env.poc`.
5. **Testing UIs:** Playwright MCP (`mcp__plugin_playwright_playwright__*`)
   is available; use it to drive the frontend in a browser.

Full rules: `CLAUDE.md`, `AGENTS.md`, `context/ENVIRONMENT.md`.
