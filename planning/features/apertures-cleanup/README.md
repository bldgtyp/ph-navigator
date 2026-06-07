---
DATE: 2026-06-07
TIME: (compiled)
STATUS: Active — three phase plans queued
AUTHOR: Claude
SCOPE: Followup cleanup items deferred during the 13-phase
       Apertures build-out (`planning/archive/apertures/`) plus
       additional refactor candidates surfaced by the 2026-06-07
       code review. Phase plans live in `phases/`.
RELATED:
  - planning/archive/apertures/STATUS.md (final state of the
    13-phase build)
  - planning/archive/apertures/PRD.md (canonical product contract)
  - planning/code-reviews/2026-06-07/aperture-builder-review.md
---

# Apertures — Cleanup follow-ups

The 13-phase Apertures feature shipped behind a tracer-bullet
coexistence pattern — V2 `Aperture*` types and the `tables.apertures[]`
slice live **side-by-side** with the legacy `Window*` /
`tables.window_types[]` surface. The TB-09 Windows tab is still
mounted; nothing has been deleted.

This folder collects:

1. The items that were knowingly deferred during the 13 build
   phases (`PRD.md` §A–§F).
2. Three new phase plans queued from the post-build review on
   2026-06-07 (`phases/phase-c02-*`, `phases/phase-c03-*`,
   `phases/phase-c04-*`).

`PRD.md` is the consolidated cleanup backlog. `STATUS.md` tracks
which items / phases have shipped and which are queued. `phases/`
holds the concrete implementation plans.

## Read order

1. `STATUS.md` — what's queued, in what order, blockers.
2. `PRD.md` — the consolidated backlog of deferred items
   (§A legacy removal, §B UI polish, §C performance, §D MCP,
   §E tests, §F out-of-scope).
3. `phases/phase-c01-window-to-aperture-removal.md` — rename the
   backend types, rewrite persisted JSON via Alembic, seed the
   default catalog rows, delete the V1 frontend folder, add the
   `/windows` → `/apertures` redirect, fold in §B.2's
   `datasheet_url` ref-column add.
4. `phases/phase-c02-backend-handler-consolidation.md` — extract
   `_shared.py` and `_ref_helpers.py`; consolidate the six
   duplicated handler helpers and the `_refresh_origin`
   divergence.
5. `phases/phase-c03-drift-cross-cutting.md` — fix the drift N+1,
   consolidate `_LiveCatalogReader` and `load_document_body`,
   hoist MCP `_Wrap`, resolve cache FIFO/LRU mismatch, convert
   `Collision` to Pydantic, wire drift-query invalidation.
6. `phases/phase-c04-frontend-hygiene.md` — memoise canvas
   mirror, consolidate test fixtures, decompose
   `ApertureCanvasContainer`, fix `popUndoEntry` contract, hoist
   catalog totals, fix picker manufacturer-filter bug, plus the
   small-win bundle and coverage backfill.
7. The archived feature docs at `planning/archive/apertures/`
   for per-phase context of the original build-out.
8. The full review at
   `planning/code-reviews/2026-06-07/aperture-builder-review.md`
   for the finding-level detail behind C-02 / C-03 / C-04.

## Phase summary

| Phase | Title | Plan |
|-------|-------|------|
| C-01 | `Window*` → `Aperture*` removal | `phases/phase-c01-window-to-aperture-removal.md` |
| C-02 | Backend handler consolidation | `phases/phase-c02-backend-handler-consolidation.md` |
| C-03 | Drift correctness + cross-cutting | `phases/phase-c03-drift-cross-cutting.md` |
| C-04 | Frontend hygiene pass | `phases/phase-c04-frontend-hygiene.md` |

C-01 ships first because the rename touches files all three
later phases also touch. C-02 / C-04 are independent and can ship
in either order or on parallel branches. C-03 sits between them on
the dependency graph.
