# PH-Navigator agent guidance

This is the canonical, tool-neutral repository guidance. Tool-specific files import it and add
only their own mechanics.

## Scope and product boundary

PH-Navigator is the current canonical web application for viewing and managing Passive House
project data during design. It uses a JSON-document model with versioned,
immutable-by-discipline saves and owns its project data rather than treating Airtable as the
application database. Older documents may call this rewrite generation “V2”; use
“PH-Navigator” for the current product and “V0” for the legacy application.

Production is live at `https://www.ph-nav.com`, with the API at
`https://api.ph-nav.com`. Treat the production database, object storage, accounts, and drafts as
real infrastructure. Current production facts belong in
[`context/PRODUCTION_DEPLOYMENT.md`](context/PRODUCTION_DEPLOYMENT.md), not in this file.

## Start with the owning authority

[`context/README.md`](context/README.md) is the full reference router. Load only the documents
needed for the task.

| Work | Read first |
| --- | --- |
| Current work, feature status, or authorization | [`planning/STATUS.md`](planning/STATUS.md), [`planning/.instructions.md`](planning/.instructions.md), then the owning feature or refactor packet |
| Product, architecture, data model, or persistence | [`context/PRD.md`](context/PRD.md), [`context/TECH_STACK.md`](context/TECH_STACK.md), and the relevant `context/technical-requirements/` document |
| Backend code | [`backend/.instructions.md`](backend/.instructions.md), then [`context/CODING_STANDARDS.md`](context/CODING_STANDARDS.md) |
| Frontend code | [`frontend/.instructions.md`](frontend/.instructions.md), then [`context/CODING_STANDARDS.md`](context/CODING_STANDARDS.md) |
| User-visible UI | [`context/DESIGN_SYSTEM.md`](context/DESIGN_SYSTEM.md), [`context/UI_UX.md`](context/UI_UX.md), and only the matching page file under `context/ui/pages/` |
| Local environment, database, ports, or login | [`context/ENVIRONMENT.md`](context/ENVIRONMENT.md) |
| Browser interaction or screenshots | [`context/USING_A_WEB_BROWSER.md`](context/USING_A_WEB_BROWSER.md) |
| Production, Render, DNS, R2, auth, or deployment | [`context/PRODUCTION_DEPLOYMENT.md`](context/PRODUCTION_DEPLOYMENT.md) and [`context/DEVELOPMENT_WORKFLOW.md`](context/DEVELOPMENT_WORKFLOW.md) |
| Project data, licensed datasets, or object storage | [`context/DATA_STORAGE.md`](context/DATA_STORAGE.md) and [`context/DATASET_PIPELINE.md`](context/DATASET_PIPELINE.md) |
| MCP tools or agent setup | [`context/mcp.md`](context/mcp.md) and [`docs/MCP_AGENT_SETUP.md`](docs/MCP_AGENT_SETUP.md) |
| Logging | [`context/LOGGING.md`](context/LOGGING.md) |
| Licensing or outside contributions | [`LICENSING.md`](LICENSING.md) and [`CLA.md`](CLA.md) |

`AGENTS.md` is not a delivery ledger. Resolve current work from the branch, `planning/STATUS.md`,
and the owning packet. Archived plans and `research/` are evidence or precedent, not current
authorization.

## Repository-specific invariants

- All calculations and data manipulation live in the backend. The frontend displays results and
  handles interaction; do not create a second calculation authority in browser code.
- Preserve the versioned JSON-document model, immutable-by-discipline saves, and the documented
  Postgres/object-store boundary. Route new storage decisions through the current technical
  requirements rather than inferring them from old plans.
- This repository is public. Never commit PHI-, Phius-, PHPP-, WUFI-, client-, or other licensed
  source data. Public fixtures are synthetic; real corpora stay in the documented gitignored
  private locations. Catalog data remains all rights reserved until its separate license lands.
- Outside contributions require the repository’s contribution agreement before merge. The CLA is
  still a draft pending counsel review; do not treat it as approved.
- Production deploys are explicit and separate from merges. Render auto-deploy is off. Never
  trigger the “Deploy Production” workflow, push a release tag, apply production datasets, or
  perform a production operator action unless Ed explicitly requests that exact operation.
- Do not modify the legacy V0 repository unless the user explicitly asks for V0 work. Nothing
  under `research/` is importable application code; rewrite useful precedent into the current
  backend or frontend boundaries.
- Proposed behavior, implemented behavior, merged code, deployed code, and production-verified
  behavior are distinct states. Keep planning and context documents synchronized with verified
  reality without collapsing those distinctions.

## Runtime and dependency rules

- Backend work uses Python 3.11, Pydantic v2, and `uv` from `backend/`. Do not use system Python,
  `pip`, activation commands, `requirements.txt`, or hand-edit `uv.lock`.
- Frontend work uses `pnpm` from `frontend/`; never npm or yarn. Preserve the 24-hour minimum
  release age, strict minimum-age enforcement, and `blockExoticSubdeps`. Run the repository
  formatting command after frontend edits.
- Do not introduce `.env` overlays. Configuration enters through the documented Pydantic settings
  and environment contracts.
- Backend features use the documented route/model/service/repository layers with raw parameterized
  SQL through narrow repositories; SQLAlchemy is limited to Alembic migrations. Frontend work
  follows feature-first ownership, the three-tier CSS token system, and the documented TanStack
  Query/Table and Zustand boundaries. The area instructions own the detail.

## Local browser and MCP safety

- Before localhost UI work, read `context/USING_A_WEB_BROWSER.md` and run
  `make agent-browser-ready`. It owns the strict `5173`/`8000` pair, same-origin `/api` proxy,
  dedicated fixture, login, health checks, and cleanup. Use `make agent-browser-check` for a
  non-mutating readiness check. Development browser code must remain same-origin through the proxy;
  do not point it directly at `:8000`.
- Drive deterministic browser checks with `frontend/scripts/agent-browser.mjs`. Do not reuse a tab
  that has shown a network or internal-data-URL error, and do not substitute general browser MCP or
  browser-extension tooling unless the owning browser guide changes. Never sign in as Ed for
  development tests, take over his running services, or leave processes you started running.
- Use `phn-local` for development, implementation tests, and local fixtures in this repository.
  Use installed production `phn` only for real BLDGTYP project work and never as test data for an
  application change. Do not duplicate either tool’s configured server.
- Production MCP writes affect the issuing user’s real draft. Read before writing and use current
  etags. Never call `save_draft` or `save_draft_as` without explicit user intent to persist, and
  never autonomously hard-delete a project. For verification-only writes, inspect the diff,
  discard the draft, and confirm removal.

## Working safely in the shared checkout

This checkout may be edited concurrently, and its index and branch are shared. Preserve unrelated
work, recheck status and branch before committing, and commit only explicit paths:

```bash
git commit -m "<message>" -- <your paths>
```

Staging paths alone does not isolate a commit from files another process already staged. Do not
reset, amend, or perform history surgery to disentangle another actor’s work. UI changes that Ed
is watching on the `:5173` development server must be made in the primary checkout serving that
process, not an unseen worktree.

## Verification and closeout

- Use focused tests while editing. Stable entrypoints are `make smoke`, `make frontend-dev-check`,
  `make format`, `make ci`, and `make help`; area instructions provide narrower commands.
- After substantive code changes, run the applicable `simplify` review and `docs-pass`, then
  `make format` and `make ci`. A trivial UI-only change may use the focused frontend gate while
  iterating, but interaction, state, data, or adapter changes require focused tests as well.
- If formatting changes files, re-inspect the diff and run `make ci`. Do not report completion,
  commit, or open a PR while a required gate is red.
- Render, browser, database, licensed-dataset, backup, and production changes have additional
  conditional gates in their owning documents. Local CI or a merge does not satisfy those gates.

## Planning

- Tracked feature and refactor work lives under `planning/`; read the applicable `.instructions.md`
  before creating, resuming, moving, or archiving a packet. Use gitignored `working/` for scratch.
