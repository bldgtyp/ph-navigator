# PHN `context/` — Canonical Reference

This folder is the stable description layer for PH-Navigator: the
canonical contracts other docs/agents treat as ground truth (product
behavior, architecture, data model, UI intent, coding standards).
Stable supporting docs that are *not* canonical contracts — operational
how-tos/setup guides, running logs/changelogs — live in `docs/` instead
(see `docs/README.md`'s litmus test). Feature PRDs, implementation plans,
dated reviews, progress ledgers, and temporary sequencing work live under
`planning/` unless they have graduated into stable `context/` contracts.

The repo was originally developed as `ph-navigator-v2` and became the canonical
`bldgtyp/ph-navigator` repo during the 2026-06 production rollout. Older context
documents may still use "V2" to describe the rewrite generation; prefer
"PH-Navigator" for current product/repo naming and "V0" for the legacy app.

The repo-root `CLAUDE.md` is the always-loaded dispatch table: it routes by
activity (backend / frontend / UI / env / logging / …) to the right doc here.
Folder-local rules digests live as `.instructions.md` files next to the code
they govern — `backend/.instructions.md`, `frontend/.instructions.md`,
`ui/pages/.instructions.md`, `planning/.instructions.md`. This file is the full
`context/` index behind that dispatch table.

## Default Startup Read

Read these first:

1. `ENVIRONMENT.md` — local command / environment card.
1a. `USING_A_WEB_BROWSER.md` — how to reliably drive/screenshot the app
   (`frontend/scripts/agent-browser.mjs`), why the browser MCP tools fail, and
   process-cleanup discipline. Read before any browser check.
2. `PRODUCTION_DEPLOYMENT.md` — live Render/DNS/R2/auth/MCP deployment source of truth.
3. `DEVELOPMENT_WORKFLOW.md` — branch, CI, and Render deploy discipline.
4. `PRD.md` — concise product and high-level architecture PRD.
5. `TECH_STACK.md` — stack and persistence decisions.
6. `GLOSSARY.md` — canonical terms when naming is ambiguous.

## On-Demand Reference

Load these only when the task touches the relevant surface:

- `USER_STORIES.md` — redirect only. The MVP story bodies are archived to
  `planning/archive/user-stories/`; the live contracts they produced live in
  `technical-requirements/*` and `ui/pages/*`. This file also carries the two
  still-open aperture questions.
- `planning/features/<feature>/README.md`, `PRD.md`, and `STATUS.md` —
  feature-focused product intent, active state, and phase routing. Load
  with the matching user-story file when implementation or review needs
  feature-level detail.
- `TECHNICAL_REQUIREMENTS.md` — router for implementation-level
  requirements split out of the PRD.
- `technical-requirements/*.md` — detailed contracts for data model,
  save/versioning, API, MCP/schema, frontend/viewer/units, and
  stack/auth/migration. Load only the relevant file.
- `UI_UX.md` — UI design intent, common elements (incl. the DataTable model
  §1.7), multi-page flows, and the state-indicator cheatsheet. Per-page
  narratives are split under `ui/pages/` — read only the page for the surface
  you are building (see `ui/pages/.instructions.md`); the §2 index lists them.
  For visual-design tasks, also load the BLDGTYP design system:
  <https://github.com/bldgtyp/bt-branding>.
- `DATA_STORAGE.md` — the map of where every kind of project data
  physically lives: the two stores (Postgres / object store) and the four
  data classes (relational metadata, versioned JSONB documents, dynamic
  per-project assets, static climate bundles), the pointer/boundary table,
  and the dev-vs-prod matrix. Load when deciding where new data should live
  or debugging a store/registry mismatch.
- `CODING_STANDARDS.md` — backend Python and frontend TypeScript
  engineering standards: layer/feature boundaries, typing, module-size,
  documentation, state ownership, and quality gates.
- `DESIGN_SYSTEM.md` — the visual-language source of truth: design tokens
  (color, type, spacing, radius, shadow, z-index), the blessed component
  inventory, and the authoring doctrine. Its self-contained "Portable spec"
  block is what you upload to Claude-Design or any external design tool. Load
  when adding a token, building a new component, or handing UI to an outside
  tool; pairs with `frontend/src/styles/README.md` (the implementation how).
- `LOGGING.md` — canonical logging architecture: structlog config,
  request-id propagation, dev vs Render production behavior, security
  rules, and the convention for event names and levels. Load when
  adding/changing log output or troubleshooting deployed runs.
- `PRODUCTION_DEPLOYMENT.md` — current production URLs, Render service IDs,
  Blueprint/env vars, DNS records, R2 bucket/CORS, cookie/CSRF posture, runtime
  MCP endpoint, deleted staging resources, and public smoke commands.
- `DEVELOPMENT_WORKFLOW.md` — branch policy, build-minute discipline, CI
  expectations, the explicit "Deploy Production" workflow (Render auto-deploy
  is off; merging to `main` does not deploy), and deploy-aware closeout rules.
- `DATABASE_BACKUPS.md` — the off-site encrypted backup system and the restore
  runbook: what is and is not backed up, the R2/Dropbox layers alongside Render
  PITR, routine operations, restore and disaster-recovery steps, the drill log,
  and key/credential rotation.
- `technical-requirements/data-table.md` — shared `<DataTable>`
  implementation contract. Load with `UI_UX.md` §1.7 and
  `ui/pages/spaces-equipment-tab.md` when touching table behavior.
- `mcp.md` — live MCP tool inventory, draft/save lifecycle, token scopes,
  structured error envelope, and token issuance pointer.

## Historical / Removed

- `planning/archive/dated/` — historical dated plans preserved for
  reference.
- `planning/code-reviews/` — dated code-review artifacts.
- `research/` — V1 reference and POC artifacts. Use as precedent only;
  nothing in `research/` is on the V2 import path.

## Planned Generated Docs

Add these only as the corresponding implementation exists:
`operations.md`, `error-codes.md`, `llm-cookbook.md`, and optional static
JSON Schema snapshots under `schemas/`. (The `/api/v1` route contract already
lives in `technical-requirements/api.md`.) The current runtime schema source
is the backend endpoint set under `/api/v1/schemas/...`.
