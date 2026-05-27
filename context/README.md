# PHN-V2 `context/` — Canonical Reference

This folder is the stable description layer for PH-Navigator V2.
Feature PRDs, implementation plans, dated reviews, progress ledgers,
and temporary sequencing work live under `planning/` unless they have
graduated into stable `context/` contracts.

## Default Startup Read

Read these first:

1. `ENVIRONMENT.md` — command / environment card.
2. `PRD.md` — concise product and high-level architecture PRD.
3. `TECH_STACK.md` — stack and persistence decisions.
4. `GLOSSARY.md` — canonical terms when naming is ambiguous.

## On-Demand Reference

Load these only when the task touches the relevant surface:

- `USER_STORIES.md` — routing document for story files and phasing.
- `user-stories/*.md` — canonical story bodies; load only the file for
  the active phase / feature cluster.
- `planning/features/<feature>/README.md`, `PRD.md`, and `STATUS.md` —
  feature-focused product intent, active state, and phase routing. Load
  with the matching user-story file when implementation or review needs
  feature-level detail.
- `TECHNICAL_REQUIREMENTS.md` — router for implementation-level
  requirements split out of the PRD.
- `technical-requirements/*.md` — detailed contracts for data model,
  save/versioning, API, MCP/schema, frontend/viewer/units, and
  stack/auth/migration. Load only the relevant file.
- `UI_UX.md` — UI narrative and page / flow descriptions.
  For visual-design tasks, also load the BLDGTYP design system:
  <https://bldgtyp.github.io/branding/> and
  <https://github.com/bldgtyp/branding>.
- `CODING_STANDARDS.md` — backend Python and frontend TypeScript
  engineering standards: layer/feature boundaries, typing, module-size,
  documentation, state ownership, and quality gates.
- `LOGGING.md` — canonical logging architecture: structlog config,
  request-id propagation, dev vs Render production behavior, security
  rules, and the convention for event names and levels. Load when
  adding/changing log output or troubleshooting deployed runs.
- `technical-requirements/data-table.md` — shared `<DataTable>`
  implementation contract. Load with `UI_UX.md` §1.7 and
  `user-stories/30-tables-equipment.md` when touching table behavior.

## Historical / Removed

- `planning/archive/dated/` — historical dated plans preserved for
  reference.
- `planning/code-reviews/` — dated code-review artifacts.
- `research/` — V1 reference and POC artifacts. Use as precedent only;
  nothing in `research/` is on the V2 import path.

## Planned Generated Docs

Add these only as the corresponding implementation exists:
`api.md`, `mcp.md`, `operations.md`, `error-codes.md`,
`llm-cookbook.md`, and optional static JSON Schema snapshots under
`schemas/`. The current runtime schema source is the backend endpoint
set under `/api/v1/schemas/...`.
