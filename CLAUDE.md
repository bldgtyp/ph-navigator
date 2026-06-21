# Project Guide for Claude — PH-Navigator V2

## Project

PH-Navigator V2 is a webapp for viewing and managing Passive House project
data during design. It is a rebuild of V1 around a JSON-document data model
with versioned, immutable-by-discipline saves. V1 (`../ph-navigator/`) still
runs; V2 is a parallel fresh-start build — **don't touch V1.**

## Status

**Planning / scaffold.** No users and no deploy yet, so backwards
compatibility is **not** required. (If this looks stale, confirm with Ed
before relying on it.)

## Read the docs first

`context/` is the canonical reference layer, and **`context/README.md` is the
doc router** — read it for reading order and on-demand routing (PRD,
TECH_STACK, GLOSSARY, CODING_STANDARDS, UI_UX, USER_STORIES, LOGGING, and the
`technical-requirements/` contracts). Load those on demand; don't restate the
map here.

Repo layout:

- `/backend` — FastAPI, raw SQL repositories, Alembic migrations
- `/frontend` — Vite + React + TypeScript
- `/context` — canonical PRD + reference docs (read first)
- `/planning` — feature PRDs, phases, status, reviews
  (read `planning/.instructions.md` before adding or moving docs; add
  `DATE`/`TIME` headers to new plans)
- `/research` — V1 POC precedent only, **not** on the import path
- `/docs`, `/working` — supporting docs; gitignored local scratch

## Hard rules

- **All calculations and data manipulation live in the backend.** The
  frontend is display + user-interaction only.
- **Python: `uv` only.** Never `python`/`python3`/`pip`/`pip3` or
  `source .venv/bin/activate`. Use `uv run <cmd>` / `uvx <tool>`; add deps
  with `uv add [--dev] <pkg>` (never hand-edit `uv.lock`). Run from the
  backend root: `cd backend && uv run …`. Python 3.11, Pydantic v2 only.
- **Node: `pnpm` only** (never npm/yarn), root `frontend/`. Keep supply-chain
  protections on (24h `minimumReleaseAge`, strict minimum-age,
  `blockExoticSubdeps`). Run `pnpm run format` after frontend changes.
- Persistence, layer/feature boundaries, and typing standards are defined in
  `context/TECH_STACK.md` and `context/CODING_STANDARDS.md` — follow them
  rather than reinventing rules here.

## Database

- Postgres 16 in Docker: `docker compose up -d db` (repo root).
- Migrations: `cd backend && uv run alembic upgrade head`.
- Never run `psql` against a system Postgres install.

## Env files

- `backend/.env` and `frontend/.env.local` — gitignored; copy from the
  matching `*.example`.
- **No overlays** — no second `.env`, no `.env.poc`. Feature flags are
  `Settings` fields with safe defaults.

## Make recipes

- `make smoke` — run first if you arrive in an unfamiliar repo state.
- `make ci` — full local mirror of CI. `make format` — Prettier + Ruff.
- `make frontend-dev-check` — fast frontend-only gate (no DB) for CSS,
  layout, and component-positioning work.
- `make help` — everything else (`dev`, `backend`, `frontend`, `test`,
  `migrate`, `e2e`, …).

## Closeout gate (after any code-changing session)

Before reporting completion, committing, or opening a PR:

1. Run the `simplify` **skill** on the diff; wait for it to finish.
2. Run the `docs-pass` **skill** on the diff; wait for it to finish.
3. Run `make format` from the repo root.
4. For substantial changes (more than a trivial UI tweak), run `make ci`.
5. If `make format` changed files, re-inspect the diff and run `make ci`.
6. Don't treat the work as done while any `make ci` step is red — fix it
   locally and rerun.

## Live UI access for agents

Full setup (CORS, seeding, worktrees) is in `context/ENVIRONMENT.md`. The
load-bearing facts:

- Frontend on **:5173**, backend on **:8000**. CORS is pinned to 5173 — don't
  fall through to a Vite fallback port. Strict start from `frontend/`:
  `pnpm run dev -- --host 127.0.0.1 --port 5173 --strictPort`.
- Sign in as `codex@example.com` / `password` (`make seed-agent-user`). **Not**
  `ed@example.com` — the single-active-session rule would kill Ed's browser
  session.
- Use the Playwright MCP / `webapp-testing` skill for browser checks. For Model
  Viewer issues, read `planning/archive/model-viewer/AGENT_BROWSER_NOTES.md`
  first.

## Things to avoid

- Don't touch `../ph-navigator/` (V1) — V2 is fully independent.
- Don't import from `research/` — it's precedent only; rewrite into `backend/`
  or `frontend/src/` if you need the code.
- No `requirements.txt` (deps live in `pyproject.toml` + `uv.lock`).
- No global `psql`/`redis-cli` install steps — use Docker + the lockfiles.

## graphify

Knowledge graph at `graphify-out/`. For codebase questions, prefer
`graphify query/path/explain` over raw grep; run `graphify update .` after
code changes. Full rules live in `.claude/skills/graphify/SKILL.md` (the skill
auto-loads on `/graphify`).
