# Project Guide for Codex (and other coding agents)

This file mirrors `CLAUDE.md` for tooling that reads `AGENTS.md`
(Codex, etc.). Keep the two in sync — when one changes, change the
other.

## Project

PH-Navigator V2 is a webapp for viewing and managing project data for
Passive House buildings during design. Rebuild of V1 around a
JSON-document data model with versioned, immutable-by-discipline
saves. V1 (`../ph-navigator/`) continues to run; V2 is a parallel
fresh-start build.

## Status

**Planning / scaffold.** No feature code yet. See `context/` for the
full PRD set and `research/` for POC artifacts from V1's catalog spike.

## Project Structure

- `/backend` — FastAPI server, raw SQL repositories, Alembic migrations
- `/frontend` — Vite + React + TypeScript app
- `/context` — **Read this first.** PRD set + LLM-targeted docs
- `/research` — POC artifacts kept as precedent (NOT on the import path)
- `/docs` — per-feature planning docs + dated plans

Start here in `context/`:
- `architecture-prd.md`, `environment-setup.md`, `tech-stack.md`,
  `ui-ux.md`, `user-stories.md`, `table-view.md`,
  `v1-*-reference.md`, `project-versioning-predecessor.md`

## Python — ALWAYS use `uv`

- NEVER `python`, `python3`, `pip`, `pip3`, `source .venv/bin/activate`.
- Use `uv run <cmd>` for commands; `uvx <tool>` for one-shot tools.
- Add deps: `uv add <pkg>` (runtime) or `uv add --dev <pkg>` (dev).
- Never edit `uv.lock` by hand — `uv sync` / `uv lock` regenerate it.
- Backend root: `backend/`. Simplest invocation: `cd backend && uv run …`.
- Python 3.11 (pinned by `.python-version`).
- Pydantic v2 only.
- Calculations + data manipulation live in the backend.
- Persistence is raw parameterized SQL through narrow repository
  modules. No SQLAlchemy ORM/Core in app code; Alembic may use
  SQLAlchemy internally for migrations only.

## Node — npm only

- `npm install`, `npm run dev`, `npm test`, `npm run build`.
- Frontend root: `frontend/`. NOT yarn, NOT pnpm.
- Run Prettier (`npm run format`) after frontend changes.

## Database

- Postgres 16 in Docker via `docker compose up -d db` from the repo
  root.
- Migrations: `cd backend && uv run alembic upgrade head`.

## Env files

- `backend/.env` (gitignored) — copy from `backend/.env.example`.
- `frontend/.env.local` (gitignored) — copy from `frontend/.env.example`.
- No overlays. No `.env.poc`. Feature flags via `Settings` defaults.

## Make recipes

- `make setup`, `make sync`, `make dev`
- `make backend`, `make frontend`
- `make test`, `make lint`, `make format`, `make migrate`, `make smoke`
- `make e2e` — Playwright end-to-end
- `make help` for the full list

## Testing UIs

Playwright is wired into this project (`.mcp.json` + the
`webapp-testing` skill for Claude). Use it to drive the frontend in a
real browser during development.

## Planning

- Markdown under `docs/plans/<YYYY-MM-DD>/…`.
- DATE/TIME headers at the top.

## New Code

- Re-use existing functions, classes, and types.
- Match existing design patterns.
- Backend = calculations; frontend = display.

## Things to avoid

- Don't touch `../ph-navigator/` (V1).
- Don't import from `research/`.
- Don't add `requirements.txt`.
