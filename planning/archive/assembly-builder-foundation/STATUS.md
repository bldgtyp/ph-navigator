---
DATE: 2026-06-04
TIME: 11:30 EDT
STATUS: Complete — Phases 1–16 merged to main. Browser-backed UI
        closeout (Phase 16 evidence + accumulated UI parity polish)
        deferred to a fresh follow-up feature; this folder is being
        archived under `planning/archive/assembly-builder/`.
AUTHOR: Claude (Opus 4.7)
SCOPE: Final status ledger for the Assembly Builder feature bundle as
       merged to main. Open UI work is the seed for the next feature
       folder, not for this one.
RELATED:
  - PRD.md
  - README.md
  - planning/code-reviews/2026-05-27/assembly-builder-foundation-review.md
---

# Assembly Builder Progress And Next Steps

## Final state

All sixteen phases of the Assembly Builder plan landed on `main`. The
phase worktrees and `codex/assembly-builder-*` branches were squashed
into single commits and removed. The envelope feature is functionally
broad and structurally refactored; what is missing is the
browser-backed parity closeout (Phase 16's release evidence) and a
deliberate UI polish pass. Both are being lifted into a fresh feature
folder rather than reopened here.

Implemented surface on `main` (live in
`backend/features/envelope/` and `frontend/src/features/envelope/`):

- typed envelope document model, read endpoints, registered read
  models for `assemblies[]` and `project_materials[]`;
- semantic `POST /draft/envelope/commands` with the full
  assembly/layer/segment/material command set, including copy-paste,
  detach-to-custom, unused cleanup, and per-material catalog refresh;
- backend thermal overlays and saved-version-only HBJSON construction
  export with structured 422 rejection for incomplete assemblies;
- Specifications evidence flow (datasheets + site photos) routed
  through the generic `project_assets` backbone;
- catalog drift report, drift badges, review summary, and per-material
  refresh dialog;
- MCP envelope read/report tools plus `apply_envelope_command` writes
  sharing the browser command boundary, tagged `updated_via='mcp'`;
- foundation refactor (Phases 9–12): service split + typed dispatch
  registry, frontend dialog/page decomposition, shared
  constants/helpers, `why`-bearing docstrings, topic-organized tests;
- UI parity bundle (Phases 13–16): collapsible sidebar/drawer, top
  assembly bar with picker/metrics/tools, main canvas view, to-scale
  DOM/CSS layer/segment drawing with orientation labels and material
  colors, scoped active-material legend, material-first Segment
  Properties dialog with project/catalog/hand-enter tabs, and the
  Phase 16 deterministic scale/evidence fixture.

## Phase ledger

| Phase | Title | Status | On `main` as |
|---|---|---|---|
| 1 | Backend domain contracts | Merged to main | `5c687c9` (squash of `codex/assembly-builder-phase-01`) |
| 2 | Read-only envelope shell | Merged to main | `5c687c9` (squash of `codex/assembly-builder-phase-02`) |
| 3 | Editor commands + canvas CRUD | Merged to main | `5c687c9` (squash of `codex/assembly-builder-phase-03`) |
| 4 | Materials picker + Specifications | Merged to main | `0901c26` |
| 5 | Thermal + HBJSON export | Merged to main | `5dac1fc` |
| 6 | Evidence attachments + site photos | Merged to main | `d711c3d` |
| 7 | Catalog refresh + drift | Merged to main | `1a75378` |
| 8 | MCP hardening + release (MCP surface only) | Merged to main | `484a4b1` (UI/browser evidence delegated to Phase 16) |
| 9 | Backend service split + dispatch registry | Merged to main | `5ee4800` |
| 10 | Frontend page/dialog split | Merged to main | `2c3bf52` |
| 11 | Shared constants + helpers | Merged to main | `fb1e733` |
| 12 | Docs + test reorganization | Merged to main | `94ac109` |
| 13 | Three-pane Assemblies shell | Merged to main | `f868d4e` |
| 14 | To-scale canvas + hover controls | Merged to main | `996ec34` |
| 15 | Dialog / material picker / Specifications polish | Merged to main | `214ad89` |
| 16 | UI parity browser hardening (fixture only) | Merged to main | `13778ae` (browser-backed closeout deferred — see below) |

Last envelope-area touch on `main` is `e29fdc8 Tokenize envelope canvas
z-index values` (2026-05-27). No envelope code has changed since.

## Deferred to the next feature folder

The following items were called out as remaining work at merge time and
were never closed. They are the seed for the next feature folder, not
items to reopen on this archived feature:

- **Phase 16 browser closeout.** Run the Playwright/MCP browser flow
  against the seeded Phase 16 fixture; capture screenshots and
  locked/viewer evidence; close out PRD §15.1 lessons log.
- **Phase 4 frontend tests.** Direct unit coverage for
  material-pick / catalog-pick / hand-enter, IP/SI editor submission,
  and use-site note commands.
- **Phase 5 thermal regression + export shape.** Steel-stud
  equivalent-conductivity regression once an AISI helper or documented
  deterministic local implementation is available; decision on whether
  V2 should depend on the Honeybee package for stricter object
  serialization in the HBJSON export.
- **Phase 6 evidence polish.** Save-As / prior-version immutability
  proof; destructive photo-count confirmation dialogs.
- **Phase 7 viewer parity.** Locked/viewer read-only drift visibility
  verification in-browser.
- **Picker UX.** Decision on whether the catalog material picker
  needs richer grouping/search before the workflow is considered
  release-ready.
- **UI rework backlog.** Visual polish, layout adjustments, and
  interaction refinements identified during browser use — explicitly
  out of scope for the original 16-phase plan and the reason this
  archive is being closed in favor of a fresh feature.

## Verification baseline (as of last touch)

The most recent scoped gates run against the merged envelope surface:

- `cd backend && uv run ruff check features/envelope`
- `cd backend && uv run ty check features/envelope tests/envelope`
- `cd backend && uv run pytest tests/envelope tests/test_mcp.py`
- `cd frontend && pnpm exec eslint src/features/envelope`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/`

Repo-level `make build`, `make typecheck`, and `make test` were
blocked at merge time by unrelated equipment / project-document /
windows / shared-table type drift. That drift has continued to evolve
under other feature work (materials catalog, dashboard, row context
menu); the next feature should re-baseline against current `main`
before reopening any envelope assertions.

## Known caveats carried into archive

- Browser smoke against the Phase 16 fixture was never executed because
  the worktree at merge time did not have a live API/dev-server
  target. `make dev` is the entry point when the next feature picks
  this up.
- The Phase 1 backend `uv run ty check` baseline noise from the
  project-document custom-field transition is still present in this
  repo; scope Ty runs to `features/envelope` until that baseline is
  reconciled.
- `make smoke` can collide with another worktree holding the
  `phn-v2-postgres` Docker container name. Stop other worktree
  databases before running smoke.
