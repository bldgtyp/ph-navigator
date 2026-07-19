# Project Guide for Claude — PH-Navigator

## Project

PH-Navigator is a webapp for viewing and managing Passive House project data
during design. This repo is the current canonical app, built around a
**JSON-document data model** with **versioned, immutable-by-discipline saves**.
PHN owns all project data (moving off AirTable). The legacy app is V0 in
`bldgtyp/ph-navigator_v0` and remains available at `https://v0.ph-nav.com`.
This codebase was historically named `ph-navigator-v2`; older context/planning
docs may still use "V2" for the rewrite generation.

Repo map: `backend/` (FastAPI + raw SQL + Alembic) · `frontend/` (Vite + React
+ TS) · `context/` (canonical reference — `context/README.md` is the full
router) · `planning/` (feature PRDs, phases, reviews) · `research/` (V1
precedent, **not** importable) · `working/` (gitignored scratch).

## Status

**Production live.** The current app serves `https://www.ph-nav.com`; the API
serves `https://api.ph-nav.com`. Treat the production database and R2 bucket as
real infrastructure. Do not assume backwards compatibility is irrelevant just
because an older doc says this was pre-launch.
Current production architecture, service IDs, DNS, R2, auth/cookie posture, and
Render verification live in `context/PRODUCTION_DEPLOYMENT.md`.

## Hard rules (apply to all work)

- **All calculations and data manipulation live in the backend.** The frontend
  displays and handles interaction only.
- **Python: `uv` only.** Never `python`/`pip`/`source .venv/bin/activate`. Use
  `uv run` / `uvx`; add deps with `uv add [--dev] <pkg>` (never hand-edit
  `uv.lock`). Run from `backend/`. Python 3.11, Pydantic v2 only.
- **Node: `pnpm` only** (never npm/yarn), root `frontend/`. Keep supply-chain
  protections on (24h `minimumReleaseAge`, strict min-age, `blockExoticSubdeps`).
  Run `pnpm run format` after frontend changes.
- **This repo is public.** Never commit PHI / Phius / PHPP / WUFI-derived or
  otherwise licensed data; route source-of-truth through the private object
  store.
- **Deploys are explicit, not merges.** Render auto-deploy is OFF; merging to
  `main` does NOT deploy production. The deploy event is the "Deploy
  Production" GitHub Actions workflow (manual dispatch from `main`, or pushing
  a `v*` tag on the tip of `main`) — and it is Ed's call, never an agent's.
  Do normal work on feature branches and keep `main` always deployable. See
  `context/DEVELOPMENT_WORKFLOW.md`.

## Closeout gate (after any code-changing session)

Before reporting completion, committing, or opening a PR:

1. Run the `simplify` **skill** on the diff; wait for it to finish.
2. Run the `docs-pass` **skill** on the diff; wait for it to finish.
3. Run `make format` from the repo root.
4. For substantial changes (more than a trivial UI tweak), run `make ci`.
5. If `make format` changed files, re-inspect the diff and run `make ci`.
6. Don't treat the work as done while any `make ci` step is red — fix and rerun.

## Working by area — read the matching guide first

`context/` is the canonical reference layer and `context/README.md` is the full
router. Before starting work in an area, read its guide; the table is the
always-loaded fast-path.

| When you're… | Read first | Always-true essentials |
| --- | --- | --- |
| writing/reviewing **backend** code | `backend/.instructions.md` → `context/CODING_STANDARDS.md` | feature layers `routes`/`models`/`service`/`repository`; strict typing (`ty`); raw parameterized SQL, no ORM |
| writing/reviewing **frontend** code | `frontend/.instructions.md` → `context/CODING_STANDARDS.md` | plain CSS on 3-tier tokens (no Tailwind/shadcn); TanStack Query for server state; `App.tsx` = composition only |
| building a specific **page / screen** | `context/ui/pages/<page>.md` + `context/UI_UX.md` §0/§1 | read only the page in hand; common elements + DataTable model live in the UI_UX core |
| **design system** / tokens / visual language / a new component / handing UI to Claude-Design | `context/DESIGN_SYSTEM.md` (→ `frontend/src/styles/README.md` for the how) | tokens + blessed component inventory + doctrine; portable spec block is self-contained for external tools; reuse before inventing; guards reject off-system CSS |
| running the app / env / DB / ports / login | `context/ENVIRONMENT.md` | frontend :5173, backend :8000; sign in as `codex@example.com` (not Ed); Postgres in Docker, Alembic migrations; no `.env` overlays |
| loading/clicking/**screenshotting** the app in a browser | `context/USING_A_WEB_BROWSER.md` | use `frontend/scripts/agent-browser.mjs` (self-cleaning, reliable) — NOT the browser MCP tools / claude-in-chrome; `make agent-browser-cleanup` reaps zombies |
| deciding **stack / persistence** | `context/TECH_STACK.md` | raw SQL + Pydantic v2 via narrow repositories; `psycopg` v3; JSONB document versions; no SQLAlchemy ORM in app code |
| deciding **where data lives** / storage boundaries | `context/DATA_STORAGE.md` | two stores (Postgres / object store), four classes (relational, versioned JSONB docs, dynamic assets, static climate bundles); Postgres owns *references*, object store owns *bytes*; signed-URL-only, private bucket |
| changing **architecture / data model** | `context/PRD.md` + `context/technical-requirements/*` | JSON-document model; versioned immutable-by-discipline saves; linear history; design for human + LLM use |
| writing/reviewing **MCP tools** | `context/mcp.md` + `context/technical-requirements/llm-mcp-schema.md` | thin wrapper over REST service layer; project-scoped bearer tokens; writes go to a draft then `save_draft` |
| adding/altering **logs** | `context/LOGGING.md` | structlog → JSON to stdout; `request_id` bound via middleware; never log secrets or request bodies |
| changing **production deploy / Render / DNS / R2 / cookies / MCP URLs** | `context/PRODUCTION_DEPLOYMENT.md` + `context/DEVELOPMENT_WORKFLOW.md` | production lives at `www.ph-nav.com` + `api.ph-nav.com`; deploys via the "Deploy Production" Actions workflow (auto-deploy off); staging is deleted unless recreated from `render.yaml` |
| **naming** / domain terms | `context/GLOSSARY.md` | — |
| picking up a **story / phase** | `context/USER_STORIES.md` (redirect) → `planning/STATUS.md`, `technical-requirements/*`, `ui/pages/*` | MVP story bodies archived to `planning/archive/user-stories/`; live contracts are the tech-req + ui/pages files |

Commands: `make smoke` (orient in an unfamiliar state), `make ci` (full local CI
mirror), `make format`, `make frontend-dev-check` (fast frontend-only gate),
`make agent-browser-ready` (self-healing local browser stack + fixture),
`make help` (everything else).

## Agent browser workflow

**Read `context/USING_A_WEB_BROWSER.md` before any browser work.** Short version:
the `@playwright/mcp` / `chrome-devtools-mcp` MCP tools and `claude-in-chrome`
are unreliable here (shared-profile lock + zombie processes + pairing failures).
**Use the self-cleaning helper instead** — it always works, never leaks a
process, and never touches the user's real Chrome:

```bash
make agent-browser-ready                                  # start :5173/:8000 + seed fixture, prints login + route
cd frontend && node scripts/agent-browser.mjs /projects/<id>/apertures --out /tmp/shot.png
```

`make agent-browser-ready` is the single supported bootstrap/repair command: it
starts or reuses the strict `5173`/`8000` services, verifies health markers,
seeds the dedicated `AGENT-BROWSER` fixture (`codex@example.com`), verifies the
Vite same-origin `/api` proxy, and prints the login + sign-in route. The fixture
is isolated by `CODEX_THREAD_ID` (`PHN_AGENT_BROWSER_ID` for other runtimes).
`make agent-browser-check` is a non-mutating readiness check.

- Verifying persisted state? Add `--settle 1200` (saves debounce ~500ms) — see
  the doc's recipes.
- Blocked by "Browser is already in use" or want to clear cross-session zombies:
  `make agent-browser-cleanup` (reaps only MCP browser tooling; never your real
  browsers). **Never leave a process running that you started** —
  `agent-browser.mjs` self-cleans; anything you background yourself, you kill.

Details, recipes, and cleanup discipline live in `context/USING_A_WEB_BROWSER.md`;
managed-service logs in `context/ENVIRONMENT.md` and `working/agent-browser/`.

## Agent MCP workflow

PH-Navigator registers a local stdio MCP server for agents in `.mcp.json` and
`.codex/config.toml` as `phn-local`. It runs
`backend/scripts/mcp_agent_stdio.py`, which reuses the gitignored
`backend/.agent-mcp-token.json` local token file, and only auto-seeds the local
`AGENT-BROWSER` fixture / issues a fresh local token when that file is missing
or stale after a DB reset. Agents should not ask Ed to run token scripts for
local dev work.

Use PHN MCP when a task needs live app/document data, table inspection, project
metadata, asset lookup, or draft write flows. Start with `list_projects`,
`get_project`, and `get_document`/`get_table`; for writes, use the latest etag
and finish with `save_draft` or `discard_draft`. Prefer semantic write tools
where they exist; use `replace_table` only for whole-table browser-parity
updates. Never commit or print plaintext `phn_mcp_...` tokens.

If `phn-local` is unavailable, run `make agent-browser-ready` and retry the MCP
check.
For HTTP-client smoke or manual config debugging, `make seed-agent-mcp` and
`make smoke-mcp-local` are available, but the default agent path is the
project-registered stdio MCP server. Production/Render MCP tokens are real
infrastructure credentials: never auto-mint or store them in committed config;
use an explicitly provided `PHN_MCP_TOKEN` or user-local MCP config. MCP does
not replace rendered UI checks: use Playwright/browser verification for DOM,
layout, interaction, auth, and visual state.

## Planning

Tracked planning lives under `planning/` — read `planning/.instructions.md`
before adding or moving docs, and add `DATE`/`TIME` headers to new plans. Local
scratch is the gitignored `working/`.

## Things to avoid

- Don't touch the legacy V0 repo (`bldgtyp/ph-navigator_v0`; local folder may
  still be `../ph-navigator` until the folder rename is done) unless the user
  explicitly asks for V0 work.
- Don't import from `research/` — it's precedent only; rewrite into `backend/`
  or `frontend/src/` if you need the code.
- No `requirements.txt` (deps live in `pyproject.toml` + `uv.lock`); no `.env`
  overlays (feature flags are `Settings` fields); no global `psql`/`redis-cli`
  install steps (use Docker + the lockfiles).

## graphify

Knowledge graph at `graphify-out/`. For codebase questions, prefer
`graphify query/path/explain` over raw grep; run `graphify update .` after code
changes. Full rules live in `.claude/skills/graphify/SKILL.md` (the skill
auto-loads on `/graphify`).
