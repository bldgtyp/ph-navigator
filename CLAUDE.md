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
router) · `ops/` (operator files for one-time infrastructure setup, e.g.
`ops/backup/`) · `planning/` (feature PRDs, phases, reviews) · `research/` (V1
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
| changing **anything a user can see** — a CSS line, a hover, a spacing tweak, a new control | `context/DESIGN_SYSTEM.md` **first** (§ Interaction states, § Component inventory, § Modal contract), then the page doc | the visual answer is already decided: reuse the component, take hover/selected/armed from the state tokens, never pick a color. "Small tweak" is exactly how off-system UI gets in |
| building a specific **page / screen** | `context/ui/pages/<page>.md` + `context/UI_UX.md` §0/§1 | read only the page in hand; common elements + DataTable model live in the UI_UX core |
| **design system** / tokens / visual language / a new component / handing UI to Claude-Design | `context/DESIGN_SYSTEM.md` (→ `frontend/src/styles/README.md` for the how) | tokens + blessed component inventory + doctrine; portable spec block is self-contained for external tools; reuse before inventing; guards reject off-system CSS |
| running the app / env / DB / ports / login | `context/ENVIRONMENT.md` | frontend :5173, backend :8000; sign in as `codex@example.com` (not Ed); Postgres in Docker, Alembic migrations; no `.env` overlays |
| loading/clicking/**screenshotting** the app in a browser | `context/USING_A_WEB_BROWSER.md` | use `frontend/scripts/agent-browser.mjs` (self-cleaning, reliable) — NOT the browser MCP tools / claude-in-chrome; `make agent-browser-cleanup` reaps zombies |
| deciding **stack / persistence** | `context/TECH_STACK.md` | raw SQL + Pydantic v2 via narrow repositories; `psycopg` v3; JSONB document versions; no SQLAlchemy ORM in app code |
| deciding **where data lives** / storage boundaries | `context/DATA_STORAGE.md` | two stores (Postgres / object store), four classes (relational, versioned JSONB docs, dynamic assets, static licensed references); Postgres owns *references*, object store owns *bytes*; signed-URL-only, private bucket |
| adding/publishing/applying **licensed datasets** | `context/DATASET_PIPELINE.md` + `context/DATA_STORAGE.md` | source in private `ph-navigator-data`; immutable versioned objects + manifest-last; production publish/deploy/apply/rollback are Ed-triggered; public tests use synthetic values only |
| changing **architecture / data model** | `context/PRD.md` + `context/technical-requirements/*` | JSON-document model; versioned immutable-by-discipline saves; linear history; design for human + LLM use |
| writing/reviewing **MCP tools** | `context/mcp.md` + `context/technical-requirements/llm-mcp-schema.md` | thin wrapper over REST service layer; project- and user-scoped bearer tokens; writes go to a draft; saving requires explicit user intent |
| adding/altering **logs** | `context/LOGGING.md` | structlog → JSON to stdout; `request_id` bound via middleware; never log secrets or request bodies |
| changing **production deploy / Render / DNS / R2 / cookies / MCP URLs** | `context/PRODUCTION_DEPLOYMENT.md` + `context/DEVELOPMENT_WORKFLOW.md` | production lives at `www.ph-nav.com` + `api.ph-nav.com`; deploys via the "Deploy Production" Actions workflow (auto-deploy off); staging is deleted unless recreated from `render.yaml` |
| operating/changing **database backups / disaster recovery** | `context/DATABASE_BACKUPS.md` | DB dumps are off-site + `age`-encrypted with the private key offline; Render PITR is the short-window net; `make backup-drill-local` round-trips the scripts locally; keys and production drills are Ed's call |
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

Choose the server from the data boundary, not from whichever name happens to
be available:

- **`phn-local`** is this application repo's development server. `.mcp.json`
  and `.codex/config.toml` register `backend/scripts/mcp_agent_stdio.py`, which
  reuses the gitignored `backend/.agent-mcp-token.json` and repairs the local
  `AGENT-BROWSER` fixture/token after a DB reset. Use it for implementation,
  tests, and local fixtures; agents should not ask Ed to run token scripts.
- **`phn`** is the installed production server for real BLDGTYP project data.
  Use it from a consulting project folder, never as a substitute for local
  fixtures while changing this app. Claude receives it through the public
  `bldgtyp/claude-plugins` plugin and `/bldgtyp:phn` skill; Codex receives the
  same generated workflow through the global installer. Installation and
  diagnostics are in `docs/MCP_AGENT_SETUP.md`.

In a BLDGTYP project folder, search the folder and its ancestors for
`.phn.json`. Pass its `phn_project_id` to project-scoped calls. If the id is
`null`, call `list_projects`, compare names/BT numbers, ask Ed to choose when
more than one match is plausible, and update only `phn_project_id` after
confirmation. A `project_not_found` / `refresh` result means re-resolve through
`list_projects`; it does not prove a permission failure.

Production `phn` uses the user-scoped credential at
`~/.config/phn/credentials.json`. Missing, expired, or revoked credentials
trigger browser device authorization; the human only approves or denies the
displayed request. Claude can explicitly refresh with `/bldgtyp:phn-login`;
Codex's installed global instructions contain the corresponding `phn-login`
command. Never request, print, paste, or store the bearer token in a project
folder. Project Settings tokens remain the manual least-privilege option when a
credential must be restricted to one project; they are not the default agent
setup.

Use PHN MCP for project metadata, status, document/table inspection, assets,
focused QA reports, and requested draft edits. Read before writing and use the
latest version/draft etag. Prefer semantic write tools; use `replace_table`
only as a whole-table browser-parity primitive. Production writes are real:
they land in the issuing user's draft, but **never call `save_draft` or
`save_draft_as` unless the user explicitly asks to persist it**. For a
verification-only change, inspect the draft diff, call `discard_draft`, and
confirm it is gone. Never autonomously hard-delete a project.

If local `phn-local` is unavailable, run `make agent-browser-ready` and retry.
`make seed-agent-mcp` and `make smoke-mcp-local` are manual debugging aids, not
the normal agent path. MCP does not replace rendered UI checks: use the
supported browser workflow for DOM, layout, interaction, auth, and visual
state. The authoritative tools, scopes, draft lifecycle, and errors live in
`context/mcp.md`.

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
