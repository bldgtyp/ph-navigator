# Project Guide for Claude — PH-Navigator V2

## Project

PH-Navigator V2 is a webapp for viewing and managing project data for
Passive House buildings during design. Rebuild of V1 around a JSON-document
data model with versioned, immutable-by-discipline saves. V1
(`../ph-navigator/`) continues to run; V2 is a parallel fresh-start build.

## Status

**Planning / scaffold.** 
- No users, no actual deploy yet. Backwards compatibility is **not** required at this stage. 
- The `context/` folder holds the canonical reference docs; 
- `planning/` holds feature PRDs, progress, reviews, and phasing;
-  `research/` holds POC artifacts from V1's catalog spike as precedent.

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

- `README.md` — reading order and doc routing
- `ENVIRONMENT.md` — how this dev environment is set up
- `PRD.md` — canonical V2 architecture PRD
- `TECH_STACK.md` — pinned stack decisions
- `GLOSSARY.md` — canonical product/domain vocabulary
- `USER_STORIES.md` — story/phasing router; load the relevant
  `context/user-stories/*.md` file on demand
- `UI_UX.md` — load on demand for UX work
- `technical-requirements/data-table.md` — load on demand for table
  behavior and `<DataTable>` implementation work
- `CODING_STANDARDS.md` — load on demand for backend or frontend feature
  code and review work

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
- Backend feature code follows `context/CODING_STANDARDS.md`: keep
  `routes.py`, `models.py`, `service.py`, and `repository.py` separate
  for every feature, preserve strict typing, split large modules, and
  document the why behind behavior.

## Node — pnpm only

- `pnpm install`, `pnpm run dev`, `pnpm test`, `pnpm run build`.
- Frontend project root: `frontend/`.
- NOT npm, NOT yarn.
- Keep pnpm supply-chain protections enabled: 24-hour
  `minimumReleaseAge`, strict minimum-age enforcement, and
  `blockExoticSubdeps`.
- Run Prettier (`pnpm run format`) after frontend changes.
- Frontend feature code follows `context/CODING_STANDARDS.md`: keep
  feature-first organization, keep `App.tsx` as provider/router
  composition, use TanStack Query for server state, and split large
  component files.

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

- `make setup` — first-time install; also the provisioning step for a
  new `git worktree` (deps + env files + Dropbox-ignore). See
  `context/ENVIRONMENT.md` § Git worktrees.
- `make dev` — bring Postgres up; prints how to launch backend + frontend
- `make backend`, `make frontend`
- `make ci`, `make check`, `make check-backend`, `make check-frontend`
- `make frontend-dev-check` — fast frontend-only layout/UI gate; no DB
- `make test`, `make typecheck`, `make lint`, `make format`,
  `make migrate`, `make smoke`
- `make e2e` — Playwright end-to-end (frontend must be running)
- See `Makefile` for the full list (or `make help`).

If you arrive in an unfamiliar repo state, **`make smoke` first.**

## Mandatory closeout gate

After any code-changing session, before reporting completion, committing,
or opening a PR:

1. Run your `simplfy` **skill** on the current diff and most recent changes. Wait until the skill is complete to proceed.
2. Run your `docs-pass` **skill** on the current diff and most recent changes. Wait until the skill is complete to proceed.
3. Run `make format` from the repo root.
4. **IF** the code change included substantial and meaningful code change (more than a simple UI tweak) Run `make ci` from the repo root.
5. **IF** `make format` changes files, inspect the diff and run `make ci`
   after those changes.
6. Do not treat the work as complete while any `make ci` step is red.
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

## Testing UIs — Playwright MCP

Playwright MCP is wired into this project (`.mcp.json` + the
`webapp-testing` skill). Use it to drive the frontend in a real browser
during development:

- `mcp__plugin_playwright_playwright__browser_navigate` etc.
- Take screenshots, snapshot the DOM, inspect console + network.

Manual `playwright` CLI tests live under `frontend/tests/e2e/` and run via
`make e2e`. Use these for regression-level tests; use the MCP for
interactive verification.

### Live UI access for agents

Use one stable path for browser inspection so agents do not burn time on
alternate ports or missing cookies:

1. Keep the frontend on `http://localhost:5173` and the backend on
   `http://localhost:8000`. If `5173` is already responding, use it; do
   not start another Vite server that falls through to `5174`.
2. If an agent must start the frontend, use strict port 5173 from
   `frontend/`: `pnpm run dev -- --host 127.0.0.1 --port 5173 --strictPort`.
   If that fails, inspect the existing `5173` server instead of using
   the fallback port. Backend CORS is configured for 5173, not arbitrary
   Vite fallback ports.
3. Before browser work, verify the API is alive:
   `curl -i http://localhost:8000/api/v1/auth/session`. A 401 response
   with `not_authenticated` is fine; `Failed to fetch` in the browser
   means the backend is unreachable or CORS/origin is wrong.
4. Seed and use the dedicated local agent account:
   `make seed-agent-user`, then sign in as `codex@example.com` /
   `password`. Do not sign in as `ed@example.com` unless the user asks;
   PHN uses a single-active-session rule and that can invalidate the
   user's browser session.
5. Prefer Playwright/browser inspection with an isolated browser session
   signed in as `codex@example.com`. If the Playwright MCP browser
   profile is locked, use the Node REPL Playwright fallback with
   `frontend/node_modules`; do not switch to another app port.
6. For Model Viewer-specific browser troubleshooting, read
   `planning/archive/model-viewer/AGENT_BROWSER_NOTES.md` before
   manual browser verification.

## Planning

- Durable description docs live in `context/`.
- Tracked feature planning lives under `planning/features/<feature>/`.
  Use `README.md`, `PRD.md`, `STATUS.md`, `phases/`, `reviews/`,
  `assets/`, and `archive/` per `planning/.instructions.md`.
- Dated historical plans live under `planning/archive/dated/`.
- Dated review artifacts live under `planning/code-reviews/`.
- Local scratch lives under gitignored `working/`; promote accepted
  decisions into `planning/` or `context/`.
- When generating a plan, add `DATE` and `TIME` headers at the top.
- Removed / superseded planning material is routed through the relevant
  feature `archive/` folder or `planning/archive/dated/`.

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
