---
DATE: 2026-06-04
TIME: 11:30 EDT
STATUS: Complete — Phases 1–16 merged to main. Folder archived under
        `planning/archive/assembly-builder/`. UI rework and browser
        closeout deferred to a fresh follow-up feature.
AUTHOR: Codex / Claude (Opus 4.7)
SCOPE: Assembly Builder implementation plan bundle (historical).
RELATED:
  - planning/archive/assembly-builder/PRD.md
  - planning/archive/assembly-builder/STATUS.md
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

This folder breaks `planning/archive/assembly-builder/PRD.md` into
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
(`planning/archive/assembly-builder/PRD.md` §15.1). During each phase:

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

All sixteen phases are merged to `main`. The `codex/assembly-builder-*`
and `assembly-builder` branches were squashed and removed. See
`STATUS.md` for the full phase table with commit references and the
deferred items lifted into the next feature folder.

| Phase | Status | On `main` as |
|---|---|---|
| 1–3 | Merged to main | `5c687c9` (squash of the Phase 1–3 worktrees) |
| 4 | Merged to main | `0901c26` |
| 5 | Merged to main | `5dac1fc` |
| 6 | Merged to main | `d711c3d` |
| 7 | Merged to main | `1a75378` |
| 8 | Merged to main (MCP surface) — browser closeout deferred | `484a4b1` |
| 9 | Merged to main | `5ee4800` |
| 10 | Merged to main | `2c3bf52` |
| 11 | Merged to main | `fb1e733` |
| 12 | Merged to main | `94ac109` |
| 13 | Merged to main | `f868d4e` |
| 14 | Merged to main | `996ec34` |
| 15 | Merged to main | `214ad89` |
| 16 | Merged to main (fixture only) — browser closeout deferred | `13778ae` |

Deferred items (Phase 16 browser closeout, Phase 4 frontend tests,
Phase 5 steel-stud regression + export shape decision, Phase 6
destructive-confirm dialogs + Save-As immutability proof, Phase 7
locked/viewer drift visibility, picker UX, and the UI rework backlog
that motivated this archive) are seeds for the next feature folder.
