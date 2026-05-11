# Environment (PHN-V2) — agent quick-card

## Python: ALWAYS uv

- `uv run <cmd>` — run a command in the project venv
- `uv add <pkg>` / `uv add --dev <pkg>` — add a dep
- `uv sync` — install/refresh from `uv.lock`
- NEVER use `python`, `python3`, `pip`, `source .venv/bin/activate`
- Backend project root: `backend/`

## Node: npm only

- `npm install`, `npm run dev`, `npm test`, `npm run build`
- Frontend project root: `frontend/`
- NOT yarn, NOT pnpm

## Database

- `docker compose up -d db` from repo root
- `cd backend && uv run alembic upgrade head` to apply migrations

## Env files

- `backend/.env` (gitignored) — copy from `backend/.env.example`
- `frontend/.env.local` (gitignored) — copy from `frontend/.env.example`
- No second `.env`. No `.env.poc`. No overlays.

## Make recipes

- `make setup` — first-time install
- `make dev` — start Postgres; prints how to launch backend + frontend
- `make backend`, `make frontend`
- `make test`, `make lint`, `make format`, `make migrate`, `make smoke`
- `make e2e` — Playwright end-to-end (frontend must be running)
- See `Makefile` for the full list (or `make help`).

## Browser testing (Playwright MCP)

Project-scoped MCP server registered in `.mcp.json`. Use
`mcp__plugin_playwright_playwright__*` for interactive verification
during development. Use `make e2e` for CLI test runs.
