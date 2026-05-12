# PHN-V2 `context/` — Canonical Reference

This folder is the stable description layer for PH-Navigator V2.
Implementation plans, dated reviews, and temporary sequencing work stay
under `docs/plans/`.

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
- `TECHNICAL_REQUIREMENTS.md` — router for implementation-level
  requirements split out of the PRD.
- `technical-requirements/*.md` — detailed contracts for data model,
  save/versioning, API, MCP/schema, frontend/viewer/units, and
  stack/auth/migration. Load only the relevant file.
- `UI_UX.md` — UI narrative and page / flow descriptions.
- `DATA_TABLE.md` — shared `<DataTable>` component contract.

## Historical / Removed

- `docs/REMOVED.md` — points to material intentionally removed from
  active context.
- `research/` — V1 reference and POC artifacts. Use as precedent only;
  nothing in `research/` is on the V2 import path.

## Planned Generated Docs

Add these only as the corresponding implementation exists:
`api.md`, `mcp.md`, `operations.md`, `error-codes.md`,
`llm-cookbook.md`, and JSON Schemas under `schemas/`.
