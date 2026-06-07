---
DATE: 2026-06-05 (last content update — items themselves are
      unchanged from the original 13-phase deferral list)
LAST_REVIEWED: 2026-06-07 (post-build review noted below)
TIME: 21:45 EDT
STATUS: Active — backlog. §A.1–§A.6 + §B.2 scheduled as Phase C-01
        (plan in `phases/phase-c01-window-to-aperture-removal.md`).
        Everything else in §B–§F remains unclaimed.
AUTHOR: Claude
SCOPE: Every cleanup / polish / followup item that was knowingly
       deferred during the 13-phase Apertures build. Grouped by
       area, each item carries the originating phase + the reason
       it was deferred so a future cleanup phase can pick them up
       with full context.
RELATED:
  - planning/features/apertures-cleanup/STATUS.md
    (canonical phase queue + ship order)
  - planning/features/apertures-cleanup/phases/
    (Phase C-02 / C-03 / C-04 plans — review-driven, NOT in this
    PRD)
  - planning/code-reviews/2026-06-07/aperture-builder-review.md
  - planning/archive/apertures/STATUS.md
  - planning/archive/apertures/PRD.md
  - planning/archive/apertures/phases/phase-01-terminology-schema-command-seam.md
  - planning/archive/apertures/phases/phase-12-drift-refresh-refs-view.md
---

# Apertures cleanup — backlog

This PRD lists the items that were **knowingly deferred during the
original 13-phase Apertures build**. It is still the source of
truth for those items.

The 2026-06-07 post-build review surfaced **additional** refactor
candidates that are not in this PRD — those live in the phase
plans under `phases/` and are tracked in `STATUS.md`. Specifically:

- **Phase C-02** (`phases/phase-c02-backend-handler-consolidation.md`) —
  duplicated handler helpers (`_find_entry`, `_replace_aperture`,
  `_audit`, `_refresh_origin`, etc.) and the
  `merge_split._refresh_origin` semantic divergence. **Not in this
  PRD.**
- **Phase C-03** (`phases/phase-c03-drift-cross-cutting.md`) —
  drift detection N+1, `_LiveCatalogReader` duplication, shared
  `load_document_body`, MCP `_Wrap` hoist, cache FIFO/LRU
  mismatch, `Collision` → Pydantic. **Not in this PRD.** Note:
  PRD §C.1 (drift-report cache key) is a separate concern and
  remains in this PRD.
- **Phase C-04** (`phases/phase-c04-frontend-hygiene.md`) — canvas
  mirror memoisation, `popUndoEntry` contract fix, picker
  manufacturer-filter bug, catalog-totals hoist, canvas-container
  decomposition, fixture extraction, test-coverage backfill.
  **Not in this PRD.**

If a reader is picking up cleanup work, start at `STATUS.md`. This
PRD is what the §A–§F items below cover; the phase plans cover the
rest.

The 13 shipped phases left the legacy `Window*` tracer-bullet
intact. The items below are the durable backlog. Order is roughly
by blast radius — schema / data-model items first, then UI polish,
then test scaffolding.

## A. Legacy `Window*` → `Aperture*` removal

These items together retire the tracer-bullet path. They should
ship as one coordinated PR because the rename touches the type
graph, the document migration shim, the persisted JSON, the
frontend feature folder, and the route table at the same time.

### A.1. Rename `Window*` domain types to `Aperture*`

- **From**: Phase 01 deferred decision (logged in archive STATUS).
- **Backend types**: `WindowTypeEntry` → `ApertureTypeEntry` (already
  shipped as new types in Phase 01; the legacy classes still exist as
  the v1 surface). `WindowElement` → `ApertureElement`,
  `WindowElementFrames` → `ApertureElementFrames`.
- **Strategy**: rename in place; re-export the legacy names as type
  aliases from `features/project_document/document.py` so any
  remaining consumers compile during the transition. Delete the
  aliases at the end of this phase.

### A.2. Rename `tables.window_types` → `tables.apertures` field

- **From**: Phase 01.
- **Backend**: drop `window_types` from `ProjectDocumentTables`. Already
  no consumers in V2 backend code beyond the legacy slice route.
- **Frontend**: drop the `windows` feature folder (see A.6).
- **Bridge**: add a `@computed_field` alias on `ProjectDocumentTables`
  for one migration window so documents persisted under the old key
  round-trip — then drop the alias after the persisted-JSON migration
  (A.4) lands.

### A.3. Document-load migration shim — id prefixes

- **From**: Phase 01.
- **Persisted state**: existing dev / staging documents carry `win_*`
  / `winel_*` ids. Rewrite to `apt_*` / `aptel_*` on the read path
  (one-shot `model_validator(mode="before")` that walks
  `tables.window_types` / `tables.apertures`).
- **Deletion criterion**: ship in the same PR as A.4 so persisted
  documents migrate before anyone hits the field-rename validation.

### A.4. Alembic migration — JSON munge + seed defaults

- **From**: Phases 01 + 03 (the blocker noted in STATUS).
- **JSON munge**: rewrite each `project_versions.body` JSON column
  in-place — move `tables.window_types[]` → `tables.apertures[]` and
  rewrite the `win_*` / `winel_*` ids.
- **Seed defaults**: insert the catalog rows `PHN-Default-Frame` and
  `PHN-Default-Glazing` (Phase 01 + Phase 03 depend on them; until
  this seed ships, `+ Add aperture type` surfaces a structured
  `aperture_default_refs_missing` 503).
- **Roll-forward only**: no downgrade path because the V1 columns
  are dropped in this migration.

### A.5. Delete `frontend/src/features/windows/`

- **From**: Phase 02 (the cutover from the tracer-bullet UI).
- **Removes**: V1 Windows tab plus every component / hook / test
  under that folder. The `Apertures` tab fully replaces it.
- **PROJECT_TABS**: drop the `windows` entry; the `apertures` entry
  was added side-by-side in Phase 02.

### A.6. `/projects/:id/windows` → `/projects/:id/apertures` redirect

- **From**: Phase 02.
- **Frontend router**: redirect any lingering bookmarks / saved
  links. Single line in the route table.

## B. UI polish

### B.1. Sidebar collapse + chevron + sticky `+ Add`

- **From**: Phase 02 ("V1-pixel-parity styling").
- **Scope**: aperture sidebar's collapse/expand state and the
  sticky-bottom `+ Add aperture type` button.
- **Why deferred**: Phase 02 shipped a functional sidebar; the polish
  pass was deliberately not in scope.

### B.2. `FrameRef` / `GlazingRef` `datasheet_url` column

- **From**: Phase 06.
- **Current behavior**: `CatalogBadges` falls back to the `source`
  field if it looks like an `http(s)://…` URL.
- **Right thing**: add an explicit `datasheet_url` column on both
  refs and the matching catalog models. Ship in the same PR as A.1
  (it's a small ref-shape change that benefits from being co-located
  with the Window → Aperture rename).

### B.3. Sonner (or equivalent) toast layer

- **From**: Phases 08, 10, 11, 12 (each deferred toast UX).
- **Why deferred**: V2 has no toast primitive yet; every shipped
  phase routes errors through the `actionError` banner / inline
  status.
- **Right thing**: pick a small library (Sonner is the working
  default) and swap the banners for toasts in one pass.
- **Touchpoints**: the merge-result audit hint (Phase 08), the
  HBJSON collision error (Phase 10), the manufacturer-filter
  Clear-all kept-enabled note (Phase 11), and the refresh dialog's
  catalog_row_missing fallback (Phase 12).

### B.4. Region-click + pick-paste interaction

- **From**: Phase 08.
- **Behavior gap**: region clicks open a card picker; pick-paste
  captures whole elements. Both flows coexist but don't share a
  click handler, so clicking a frame rect while in pick-paste mode
  still opens the picker.
- **Right thing**: route pick-paste mode through the same click
  handler so the picker stays suppressed while the eyedropper /
  paint-bucket is active.

### B.5. Project-wide drift report side panel + jump-to-card

- **From**: Phase 12.
- **What shipped**: `BuilderDriftBanner` + inline Review-all modal
  for the **active** aperture.
- **Right thing**: a project-header `⋯ → Catalog drift report`
  action that opens a side panel grouped by aperture, with a
  `Jump to card` link per entry that navigates to the matching
  aperture and scrolls the card into view.

### B.6. `BuilderDriftReviewAllModal` extraction

- **From**: Phase 12.
- **Current**: the review-all list is rendered inline by
  `BuilderDriftBanner.tsx`.
- **Right thing**: extract into its own component once a second
  caller (e.g. the side panel in B.5) needs the same list.

### B.7. Refresh dialog `Edit a third value` typed inputs

- **From**: Phase 12.
- **Current**: one text input regardless of field type; the server
  re-validates through Pydantic and returns a 422 the user sees.
- **Right thing**: render a typed input (number / select / boolean)
  per field-schema kind so the LLM-friendly third-value path doesn't
  bounce through a server round-trip on the obvious cases.

## C. Performance / caching

### C.1. Drift-report cache key

- **From**: Phase 12, risk R-12-1.
- **Current**: every drift-report call walks every element × field
  with a per-record catalog read.
- **Right thing**: memoise the report by `(catalog_snapshot_id,
  document_hash)` so consecutive calls in the same session hit a
  cache. The snapshot id is currently null; ships with whatever
  catalog-versioning work re-introduces it.

### C.2. U-Value debounce

- **From**: Phase 09.
- **Current**: the mutation-success invalidation already fires once
  per command. Rapid sequential edits would re-fetch each time.
- **Right thing**: wrap the hook in a 300ms debounce; only matters
  if a future gesture (a slider, say) issues high-frequency commands.

## D. MCP polish

### D.1. Explicit `mcp_actor_id` audit field

- **From**: Phase 13.
- **Current**: `updated_via="mcp"` plus the token's user id covers
  the audit trail.
- **Right thing**: add an explicit `mcp_actor_id` column when MCP
  tokens grow a distinct identity (LLM service account vs.
  impersonation).

### D.2. Explicit edit-lease holder names

- **From**: Phase 13.
- **Current**: `load_draft_context` is the per-user-draft seam;
  there is no separate lease object.
- **Right thing**: when V2 grows a real edit-lease layer, use
  holder names `mcp:<token_id>` and `browser:<user_id>` so conflict
  toasts can name the other holder.

### D.3. MCP-driven Save / Save As

- **From**: Phase 13.
- **Current**: V1 requires a browser to commit; MCP writes through
  the draft buffer only.
- **Right thing**: expose `save_draft` / `save_as_version` MCP
  tools once the locked-version / Save As policy stabilises.

## E. Tests / coverage

### E.1. Playwright E2E

- **From**: PLAN.md closeout policy.
- **Current**: no E2E coverage for the Apertures tab; per-phase
  Vitest covers components and helpers.
- **Right thing**: a focused E2E run that covers `+ Add → pick frame
  → pick glazing → set dimension → export HBJSON` plus a regression
  for the drift dialog and the manufacturer-filter modal.

### E.2. V1 fixture parity tests for the U-Value service

- **From**: Phase 09.
- **Current**: V2 ships against derived expected ranges (the V1
  source lives under `../ph-navigator/`, which V2 CI doesn't touch).
- **Right thing**: lift the V1 fixture corpus into a dated review
  folder once the cleanup phase or a certification audit demands
  it.

### E.3. `BuilderDriftBanner.test.tsx` / `ProjectRefsView.test.tsx`

- **From**: Phase 12.
- **Current**: the data logic underneath both components is fully
  covered by `refsAggregation.test.ts` and `RefreshDialog.test.tsx`.
- **Right thing**: add presentational smoke tests if either
  component grows non-trivial state.

## F. Out-of-scope-by-design (do not pull into cleanup)

These items were considered and explicitly excluded:

- **Bulk MCP commands** — v1 enforces one command per call.
- **Read-safe drift status endpoint for viewers** — Phase 12 noted
  this needs a separate non-editor endpoint; ships only if a real
  viewer-workflow gap appears.
- **Catalog-manager surface** — own feature folder; do not bundle
  with Apertures cleanup.
- **Full project-wide auto-refresh** — explicitly out of scope per
  PRD §15.
- **Promotion of refreshed-value into `local_overrides`** — Phase
  12 explicit decision; revisit only if a real workflow needs it.
