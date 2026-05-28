---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Proposed phased implementation roadmap.
AUTHOR: Codex
SCOPE: Assembly Builder implementation plan bundle.
RELATED:
  - planning/features/assembly-builder/PRD.md
  - planning/features/assembly-builder/STATUS.md
  - context/user-stories/20-envelope.md
  - context/technical-requirements/data-model.md
  - context/technical-requirements/save-versioning.md
  - context/technical-requirements/attachments.md
  - context/technical-requirements/api.md
  - planning/features/ip-si-unit-switching/PRD.md
  - context/technical-requirements/llm-mcp-schema.md
  - context/CODING_STANDARDS.md
---

# Assembly Builder Implementation Plans

This folder breaks `planning/features/assembly-builder/PRD.md` into
manageable implementation phases. Each phase should be treated as a
verifiable slice with its own tests, browser checks, and docs-pass.

The PRD remains the product contract. These plans describe execution
order and gates; they should not override the PRD unless the PRD is
updated in the same pass.

Use `STATUS.md` as the active handoff tracker for completed
work, known caveats, and the next phase to pick up.

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
| 8 | `phase-08-mcp-hardening-release.md` | MCP tools and semantic command hardening; remaining UI/browser release evidence is delegated to Phase 16. | MCP read/write tools share the browser command boundary and remaining browser gates have a single owner. |
| 9 | `phase-09-backend-service-split.md` | Foundation refactor: split the 1061-line backend service module and replace the `isinstance` command cascade with a typed dispatch registry. | No backend envelope module exceeds the 600-line soft limit; existing tests pass unchanged. |
| 10 | `phase-10-frontend-page-dialog-split.md` | Foundation refactor: decompose the three frontend files past the documented soft/hard limits; extract `useLengthDraft` and the attachment workflow. | No envelope frontend file exceeds the 300-line soft limit (with documented exceptions for declarative files); `EnvelopePage.test.tsx` passes unchanged. |
| 11 | `phase-11-shared-constants-helpers.md` | Foundation refactor: name canvas calibration values, share `argbColor` and `downloadBlob` helpers, dedupe "next free name" loops. | No magic numbers in canvas / page files; new helpers ship with unit tests. |
| 12 | `phase-12-docs-and-test-reorg.md` | Foundation closeout: add "why"-bearing docstrings on public service / thermal entry points; rename envelope tests by topic instead of phase. | Public service entry points and thermal math anchored to documented contracts; tests organized by concern. |
| 13 | `phase-13-three-pane-assemblies-shell.md` | UI parity: reshape Assemblies into the V1-derived sidebar/drawer, top-bar, and main-view workspace using V2 styling. | Implemented shell has stable sidebar/top-bar switching with the canvas ready to occupy the main view; browser evidence remains for Phase 16. |
| 14 | `phase-14-to-scale-canvas-hover-controls.md` | UI parity: replace the scaffold canvas with a to-scale colored layer/segment drawing and compact hover/focus controls. | Implemented canvas uses SI-canonical geometry, material colors, orientation labels, contextual controls, and an active-material legend; browser evidence remains for Phase 16. |
| 15 | `phase-15-dialogs-material-picker-specifications-polish.md` | UI parity: polish Segment Properties, material picker, shared material editor, and Specifications QA cards. | Browser can complete material and specification workflows through V2-native dialogs that preserve V1's mental model. |
| 16 | `phase-16-ui-parity-browser-hardening.md` | UI parity closeout: V1 parity audit, realistic scale fixture, browser evidence, locked/viewer verification, and docs-pass. | Assembly Builder is release-ready or remaining gaps are explicitly deferred/blocking with evidence. |

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
- Preserve V1's Assembly Builder mental model for the UI parity phase:
  collapsible assembly sidebar/drawer, top assembly bar with active
  assembly picker, primary to-scale canvas view, compact hover/focus
  controls, material colors, and legend. Update the visual skin to V2
  styling rather than copying V1 literally.
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
(`planning/features/assembly-builder/PRD.md` §15.1). During each phase:

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
  in v1;
- the V2 Assembly Builder keeps both assembly-switching affordances:
  sidebar/drawer row selection and top-bar picker selection.

## Progress Ledger

| Phase | Status | Evidence |
|---|---|---|
| 1 | Merged to main | Implemented on `codex/assembly-builder-phase-01`; flattened into main with the Phase 1-3 squash merge. Verified with `git diff --check`, `backend` Ruff, scoped Ty, `tests/test_envelope_phase01.py`, and `tests/test_schemas.py`. |
| 2 | Merged to main | Read-only shell implemented on `codex/assembly-builder-phase-02` (`929f5b8`, simplify follow-up `bd77dee`); flattened into main with the Phase 1-3 squash merge. Verified with targeted Envelope/Windows tests, `tsc --noEmit`, frontend build, ESLint, feature-shape check, `git diff --check`, and local browser smoke on a seeded envelope project. |
| 3 | Merged to main | Editor commands implemented on `codex/assembly-builder-phase-03` (`9e6c560`, simplify follow-up `1d87078`, docs-pass `0458eae`); flattened into main with the Phase 1-3 squash merge. Verified with backend envelope Ruff/Ty/Pytest gates, frontend Prettier/TS/Vitest/ESLint/shape/build gates, `git diff --check`, and browser smoke covering modal unit toggle, copy/paste assignment, Save, and reload. `make smoke` remains blocked by the local shared `phn-v2-postgres` Docker container name conflict. |
| 4 | Implemented on branch | Implemented on `codex/assembly-builder-phase-04` with backend material commands, catalog copy-in, shared material editor, Specifications editing, detach, unused cleanup, simplify follow-up, and scoped backend/frontend gates. Browser smoke and direct material-flow frontend tests remain before closure. |
| 5 | Implemented on branch | Implemented on `codex/assembly-builder-phase-05` with backend thermal endpoint, shared thermal issue records, saved-version-only HBJSON export, metadata preservation, export 422 paths, frontend thermal label, shared download handling, and dirty-draft warning. Steel-stud regression, browser smoke, and export-shape hardening remain before closure. |
| 6 | Implemented on branch | Implemented on `codex/assembly-builder-phase-06` with Specifications datasheet/photo evidence UI, generic asset attach/detach wiring, envelope attachment tests, shared URL resolution, and attachment row-resolution hardening. Browser smoke, Save As immutability workflow, and destructive photo-count dialogs remain. |
| 7 | Implemented on branch | Implemented on `codex/assembly-builder-phase-07` with material catalog drift report, same-version field-delta detection, source-deactivated/missing states, per-material refresh command, badges, review summary, and refresh dialog. Browser smoke remains before closure. |
| 8 | In review | MCP envelope read/report tools and semantic command write tool implemented on `codex/assembly-builder-phase-07`; verified with scoped backend Ruff/Ty and `tests/test_mcp.py`. Remaining UI/browser release evidence is delegated to Phase 16. |
| 9 | Implemented on branch | Implemented on `codex/assembly-builder-phase-09` with backend envelope service split, command dispatch registry, shared material-field constants, and drift transaction threading. Verified with scoped envelope Ruff/Ty/Pytest gates; full repo `make test` and `make typecheck` remain blocked by unrelated project-document custom-field test drift. |
| 10 | Implemented on branch | Implemented on `assembly-builder` with frontend dialog decomposition, page helper extraction, shared `DialogActions`, dedicated `useLengthDraft` hook/test, attachment mutation hook, route helpers, and Specifications subcomponents. Scoped envelope lint/tests/type filter pass; full frontend build remains blocked by unrelated equipment/project-document/windows/shared table type drift. |
| 11 | Implemented on branch | Implemented on `assembly-builder` with canvas constants, shared ARGB/download helpers, and helper tests. Full frontend build remains blocked by unrelated equipment/project-document/windows/shared table drift. |
| 12 | Implemented on branch | Implemented on `assembly-builder` with public-service documentation and envelope test reorganization. Full frontend build, repo-level `make typecheck`, and repo-level `make test` remain blocked by unrelated table drift; `make lint` passed. |
| 13 | Implemented on branch | Three-pane Assemblies shell implemented on `codex/assembly-builder-ui-planning`: collapsible assembly drawer, top-bar picker/metrics/tools, main canvas area, scoped active-material legend, shared icon-button/tooltip utility styling, and regression coverage for collapse preserving active assembly and zoom. Browser evidence remains for Phase 16. |
| 14 | Implemented on branch | To-scale DOM/CSS canvas implemented on `codex/assembly-builder-ui-planning`: orientation labels, colored layer/segment blocks, clipped stable labels, contextual hover/focus controls, contextual aria labels, active-material legend with lambda status, and regression coverage for legend scoping. Browser smoke is blocked locally by missing backend/API and remains owned by Phase 16. |
| 15 | Proposed | Dialog, material-picker, and Specifications polish plan added. No implementation yet. |
| 16 | Proposed | UI parity browser hardening and release-evidence plan added. No implementation yet. |
