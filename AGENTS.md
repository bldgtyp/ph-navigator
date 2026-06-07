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
canonical reference docs, `planning/` for feature PRDs, progress,
reviews, and phasing, and `research/` for POC artifacts from V1's
catalog spike.

## Project Structure

- `/backend` — FastAPI server, raw SQL repositories, Alembic migrations
- `/frontend` — Vite + React + TypeScript app
- `/context` — **Read this first.** Canonical PRD + stable reference docs
- `/planning` — feature PRDs, phase plans, status ledgers, reviews, and
  planning archives. Read `planning/.instructions.md` before adding or
  moving planning docs.
- `/research` — POC artifacts kept as precedent (NOT on the import path)
- `/docs` — stable supporting docs that do not belong in startup context
- `/working` — gitignored local scratch for handoffs, logs, screenshots,
  and temporary notes

Start here in `context/`:
- `README.md`, `ENVIRONMENT.md`, `PRD.md`, `TECH_STACK.md`,
  `GLOSSARY.md`
- Load `USER_STORIES.md` on demand as the story/phasing router, then
  load only the relevant `context/user-stories/*.md` file for the
  active phase or feature cluster. Load `UI_UX.md` on demand when the
  task touches UX, and `context/technical-requirements/data-table.md`
  on demand when the task touches table behavior.
- Load `CODING_STANDARDS.md` on demand when adding or reviewing backend
  or frontend feature code.

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
- Backend feature code follows `context/CODING_STANDARDS.md`: keep
  `routes.py`, `models.py`, `service.py`, and `repository.py` separate
  for every feature, preserve strict typing, split large modules, and
  document the why behind behavior.

## Node — pnpm only

- `pnpm install`, `pnpm run dev`, `pnpm test`, `pnpm run build`.
- Frontend root: `frontend/`. NOT npm, NOT yarn.
- Keep pnpm supply-chain protections enabled: 24-hour
  `minimumReleaseAge`, strict minimum-age enforcement, and
  `blockExoticSubdeps`.
- Run Prettier (`pnpm run format`) after frontend changes.
- Frontend feature code follows `context/CODING_STANDARDS.md`: keep
  feature-first organization, keep `App.tsx` as provider/router
  composition, use TanStack Query for server state, and split large
  component files.

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
- `make ci`, `make check`, `make check-backend`, `make check-frontend`
- `make frontend-dev-check` — fast frontend-only layout/UI gate; no DB
- `make test`, `make typecheck`, `make lint`, `make format`,
  `make migrate`, `make smoke`
- `make e2e` — Playwright end-to-end
- `make help` for the full list

## Mandatory closeout gate

After any code-changing session, before reporting completion, committing,
or opening a PR:

1. Run `make format` from the repo root.
2. Run `make ci` from the repo root.
3. If `make format` changes files, inspect the diff and run `make ci`
   after those changes.
4. Do not treat the work as complete while any `make ci` step is red.
   Fix the failure locally, then rerun `make ci`.

`make ci` mirrors `.github/workflows/ci.yml`: backend locked `uv`
sync, Ruff format check, Ruff lint, Ty, Alembic migration, pytest;
frontend frozen `pnpm` install, Prettier check, ESLint, structural
guards, Vitest, and production build.

For simple frontend layout, CSS, typography, and component-positioning
iterations, use `make frontend-dev-check` for fast feedback. It runs
frontend Prettier check, ESLint, structural guards, and the production
build without touching Postgres, Alembic, backend pytest, frozen install,
or the full Vitest suite. If the change affects interaction, state,
queries, parsing, or data transforms, also run the focused frontend test
with `cd frontend && pnpm exec vitest run <test-file>`. The final gate
is still the full `make format` + `make ci` sequence.

## Testing UIs

Playwright is wired into this project (`.mcp.json` + the
`webapp-testing` skill for Claude). Use it to drive the frontend in a
real browser during development.

## Planning

- Durable description docs live in `context/`.
- Tracked feature planning lives under `planning/features/<feature>/`.
  Use `README.md`, `PRD.md`, `STATUS.md`, `phases/`, `reviews/`,
  `assets/`, and `archive/` per `planning/.instructions.md`.
- Dated historical plans live under `planning/archive/dated/`.
- Dated review artifacts live under `planning/code-reviews/`.
- Local scratch lives under gitignored `working/`; promote accepted
  decisions into `planning/` or `context/`.
- DATE/TIME headers at the top of new plans.

## New Code

- Re-use existing functions, classes, and types.
- Match existing design patterns.
- Backend = calculations; frontend = display.

## Things to avoid

- Don't touch `../ph-navigator/` (V1).
- Don't import from `research/`.
- Don't add `requirements.txt`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user invokes `$graphify`, `/graphify`, or otherwise asks to use
Graphify, load the Graphify skill before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
