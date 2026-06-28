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
| running the app / env / DB / ports / login | `context/ENVIRONMENT.md` | frontend :5173, backend :8000; sign in as `codex@example.com` (not Ed); Postgres in Docker, Alembic migrations; no `.env` overlays |
| deciding **stack / persistence** | `context/TECH_STACK.md` | raw SQL + Pydantic v2 via narrow repositories; `psycopg` v3; JSONB document versions; no SQLAlchemy ORM in app code |
| deciding **where data lives** / storage boundaries | `context/DATA_STORAGE.md` | two stores (Postgres / object store), four classes (relational, versioned JSONB docs, dynamic assets, static climate bundles); Postgres owns *references*, object store owns *bytes*; signed-URL-only, private bucket |
| changing **architecture / data model** | `context/PRD.md` + `context/technical-requirements/*` | JSON-document model; versioned immutable-by-discipline saves; linear history; design for human + LLM use |
| adding/altering **logs** | `context/LOGGING.md` | structlog → JSON to stdout; `request_id` bound via middleware; never log secrets or request bodies |
| **naming** / domain terms | `context/GLOSSARY.md` | — |
| picking up a **story / phase** | `context/USER_STORIES.md` → `context/user-stories/*` | — |

Commands: `make smoke` (orient in an unfamiliar state), `make ci` (full local CI
mirror), `make format`, `make frontend-dev-check` (fast frontend-only gate),
`make help` (everything else).

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
