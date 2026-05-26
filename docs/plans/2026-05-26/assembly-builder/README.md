---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Proposed phased implementation roadmap.
AUTHOR: Codex
SCOPE: Assembly Builder implementation plan bundle.
RELATED:
  - docs/features/assembly-builder-prd.md
  - context/user-stories/20-envelope.md
  - context/technical-requirements/data-model.md
  - context/technical-requirements/save-versioning.md
  - context/technical-requirements/attachments.md
  - context/technical-requirements/api.md
  - docs/features/ip-si-unit-switching-prd.md
  - context/technical-requirements/llm-mcp-schema.md
  - context/CODING_STANDARDS.md
---

# Assembly Builder Implementation Plans

This folder breaks `docs/features/assembly-builder-prd.md` into
manageable implementation phases. Each phase should be treated as a
verifiable slice with its own tests, browser checks, and docs-pass.

The PRD remains the product contract. These plans describe execution
order and gates; they should not override the PRD unless the PRD is
updated in the same pass.

## Phase Map

| Phase | Plan | Primary Goal | Exit Signal |
|---|---|---|---|
| 1 | `phase-01-backend-domain-contracts.md` | Typed envelope document model, read endpoints, registered read models. | Backend validates envelope data and serves typed read slices. |
| 2 | `phase-02-readonly-envelope-shell.md` | Read-only Envelope routes, sidebar, canvas, and Specifications card scaffolds. | Browser can inspect seeded assemblies/materials in editor, locked, and viewer modes. |
| 3 | `phase-03-editor-commands-canvas-crud.md` | Semantic command endpoint plus assembly/layer/segment editor workflows. | Browser can create/edit/delete assembly geometry and Save through the draft model. |
| 4 | `phase-04-materials-picker-specifications.md` | Project materials, catalog copy-in, shared material editor, detach, unused cleanup. | Browser can assign, edit, fork, and review project materials across use-sites. |
| 5 | `phase-05-thermal-hbjson-export.md` | Backend thermal overlay and HBJSON construction export. | Golden thermal fixtures pass and export rejects incomplete assemblies clearly. |
| 6 | `phase-06-evidence-attachments-site-photos.md` | Datasheet and site-photo evidence workflows inside Specifications. | Evidence upload/preview/detach works without mutating old saved versions. |
| 7 | `phase-07-catalog-refresh-drift.md` | Material catalog drift detection and per-material refresh. | Drift and source-deactivated states are reviewable and explicitly applied. |
| 8 | `phase-08-mcp-hardening-release.md` | MCP tools, scale hardening, accessibility, docs, and release readiness. | Full feature passes local and browser gates with lessons folded back into the PRD. |

## Global Constraints

- Do not touch V1 (`../ph-navigator/`) and do not import from
  `research/`.
- Keep feature data in the project document draft/version body:
  `tables.assemblies[]` and `tables.project_materials[]`.
- Use semantic envelope commands for browser and MCP mutations; do not
  hand-author nested array JSON-Patch in UI components.
- Keep attachment bytes in the generic `project_assets` backbone.
- Keep calculations and HBJSON serialization in the backend.
- Keep all stored/transported envelope numbers SI canonical; use the
  shared IP/SI unit helpers for layer heights, segment widths,
  steel-stud spacing, conductivity / lambda, density, specific heat,
  total thickness, thermal labels, and material previews.
- Keep frontend code under `frontend/src/features/envelope/` and
  backend code under `backend/features/envelope/`, unless a phase
  explicitly explains why existing feature packages own the work.
- Coordinate with the active custom-field / table-schema reshape before
  Phase 1. Do not begin envelope schema work while backend document
  schema/typecheck is in an intentionally broken transition state.

## Verification Ladder

Each phase may add narrower checks, but the default completion ladder is:

1. `git diff --check`
2. Backend shape changes:
   - `cd backend && uv run ruff check .`
   - `cd backend && uv run ty check`
   - targeted `uv run pytest ...`
3. Frontend changes:
   - `cd frontend && pnpm run format`
   - `cd frontend && pnpm test -- --run <targeted tests>`
   - `cd frontend && pnpm run build`
4. Integrated feature changes:
   - `make test`
   - `make typecheck`
   - `make lint`
   - `make smoke`
5. Browser acceptance:
   - local dev server running;
   - Playwright or Browser-driven smoke matching the phase gate;
   - screenshots or notes saved in the implementation report when UI
     layout/interaction changed materially.

Do not mark a phase complete from unit tests alone when the phase has a
browser-visible workflow.

## Lessons Workflow

The main PRD now includes `Implementation Lessons Log`
(`docs/features/assembly-builder-prd.md` §15.1). During each phase:

- add a short lesson row when implementation reveals a durable
  invariant, repeated failure mode, rejected shortcut, or changed
  scope boundary;
- update the relevant PRD section in the same pass if the lesson
  changes product or architecture contract;
- keep routine status in the phase plan or implementation report, not
  in the PRD lesson log.

## Decision Queue

No user input is required before Phase 1 planning/implementation. These
defaults are active unless a phase spike proves otherwise:

- project-material names may duplicate;
- envelope mutations use semantic commands;
- segment widths normalize per layer;
- unit toggling changes labels/input units only, never canonical
  payloads, canvas proportions, zoom state, or draft dirtiness;
- segment-owned `use_site_notes` preserve V1's per-segment note
  capability, while product notes and specification status stay on
  `project_materials[]`;
- HBJSON export reads the saved version body and rejects incomplete
  assemblies instead of silently omitting them;
- HBJSON import is an explicit V1.1 parity gap, not a forgotten v1
  scope item;
- missing conductivity does not block Save but blocks valid thermal
  calculation/export;
- `catalog_origin.local_overrides` is preserved verbatim after refresh
  in v1.

## Progress Ledger

| Phase | Status | Evidence |
|---|---|---|
| 1 | Proposed | Plan drafted. |
| 2 | Proposed | Plan drafted. |
| 3 | Proposed | Plan drafted. |
| 4 | Proposed | Plan drafted. |
| 5 | Proposed | Plan drafted. |
| 6 | Proposed | Plan drafted. |
| 7 | Proposed | Plan drafted. |
| 8 | Proposed | Plan drafted. |
