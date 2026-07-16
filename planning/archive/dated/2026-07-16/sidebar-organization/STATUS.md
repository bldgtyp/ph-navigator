---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: COMPLETE — all phases (0–4) shipped to production + browser-verified (2026-07-16); archived
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Disposition + phase map for sidebar-organization.
RELATED: ./README.md; ./PRD.md
---

# STATUS — Sidebar organization

**State:** COMPLETE. All phases (0–4) shipped to production via PR #35
(squash-merge `c4361842`) and browser-verified 2026-07-16. Nothing outstanding.

The browser-verification that had been deferred was completed after building the
new reliable browser tooling (PR #36): drove the live app, confirmed the sort
toggle, Manual-mode drag handles, the New-group affordance, and that the Manual
setting **persists across a fresh reload** (backend round-trip). See
`context/USING_A_WEB_BROWSER.md` for the tooling.

## Phase map

- **Phase 0 — Consolidate sidebars. ✅ DONE (2026-07-15).** Both feature sidebars
  now delegate to one shared `ElementSidebar` (`frontend/src/shared/ui/element-sidebar/`);
  `ApertureSidebar`/`EnvelopeSidebar` are thin adapters keeping their prop APIs.
  Sidebar-internal CSS moved to `element-sidebar.css`; feature sheets keep only
  page-layout/stacking. The Apertures rename-state overlap (Item 6) is fixed by
  construction — apertures no longer use their divergent `<ul>/<li>` markup; both
  render the envelope's proven `position: relative` row with the `::before`
  full-row hit overlay. The near-identical per-feature `SidebarActionButton` is
  now a single button inside the shared component.
- **Phase 1 — Persistence foundation. ✅ DONE (2026-07-16).** Backend-backed,
  per-user × per-project × per-sidebar store, modeled on `features/table_views/`:
  new `backend/features/sidebar_views/` (routes/models/service/repository) + table
  `user_sidebar_views` (migration `20260716_0006`, opaque JSONB payload, PK
  `(user_id, project_id, view_key)`, both FKs `ON DELETE CASCADE`); frontend
  `features/sidebar_views/` (types/api/lib/hooks) with `useProjectSidebarViewState`
  (debounced save, single-flight) and the composed `useSidebarOrganization` hook
  (sort-mode + `applySidebarOrder`). Foundation only — **the sort-mode toggle UI
  and drag are Phase 2** (an inert toggle would ship confusing UX; the toggle is
  only meaningful once manual ordering exists). Payload schema already carries
  `order`/`groups`/`collapsed_group_ids` so Phases 2–4 need no new migration.
- **Phase 2 — Manual ordering (G1) + sort-mode toggle. ✅ DONE (2026-07-16).**
  `useSidebarOrganization` wired into both adapters (`ApertureSidebar` gained a
  `projectId` prop, threaded from `AperturesTab`; `EnvelopeSidebar` already had it).
  `ElementSidebar` renders the alphabetical | manual sort toggle (editors only) and,
  in manual mode, dnd-kit drag handles (`SortableRows`/`SortableRow`) that reorder +
  persist via `onReorder`. Uses the repo's existing `@dnd-kit` deps and the
  field-editor drag idiom (PointerSensor distance:4 + KeyboardSensor); switching to
  manual freezes the current order. ⚠️ Visual drag verification deferred (Playwright
  profile locked this session) — confirm before/after merge.
- **Phase 3 — Grouping (G2). ✅ DONE (2026-07-16).** Pure ops in
  `sidebar_views/groups.ts` (`buildSidebarTree` + add/rename/delete/move/reorder);
  `useSidebarOrganization` exposes `groups`/`ungrouped`/`hasGroups` + operations.
  In manual mode, defining a group turns the flat list into a tree: group sections
  (each a `SortableRows` for within-group drag) + an Ungrouped remainder + a "New
  group" button. Assignment is a per-row **native `<select>`** ("move to group") —
  chosen over a popover (clipped by the list overflow) and over cross-container drag
  (fragile to ship unverified). Group order is up/down buttons (avoids nested DnD).
  ElementSidebar split into `types.ts`/`rows.tsx`/`GroupedList.tsx` to stay under the
  500-line guard. **Open Qs resolved:** #2 new items → Ungrouped (bottom); #3 groups
  apply only in manual mode (alphabetical flattens but preserves them); #5 empty
  groups allowed (explicit delete; members fall back to Ungrouped).
- **Phase 4 — Collapse (G3). ✅ DONE (2026-07-16).** Each group header has a
  chevron that toggles `collapsed_group_ids` (persisted); collapsed groups hide
  their rows. `deleteGroup` clears the group's collapsed flag. Folded into the
  Phase 3 build since the group header naturally carries the collapse control.

## Next step

None — shipped, verified, archived. Possible future enhancements (not committed):
cross-container drag to assign items between groups (v1 uses the move-to-group
select), and drag-reorder of groups (v1 uses up/down buttons).

## Blockers

- None. All open questions resolved (#1/#4 by Ed 2026-07-15; #2/#3/#5 during
  Phase 3).

## Deploy note (historical)

Merged as a **bundle** (Phases 1–4 together) via PR #35, not mid-feature: Phase 1
ships no user-visible change, and a Phase-2 toggle is
confusing without the drag it gates. Phase 0 remains the only independently
shippable slice (it fixes live bug Item 6).

## Verification

### Phase 0 (done)

- ✅ Both sidebars render through the shared `ElementSidebar` (adapters delegate).
- ✅ `make frontend-dev-check` green (format, lint, `check:all` incl. z-index/CSS
  guards, build); `AperturesHeader.test.tsx` + `EnvelopePage.test.tsx` — 51/51 pass
  (sidebar rename, type-icon-per-type, collapse toggle, tooltip-outside-list).
- ⚠️ Item 6 rename-overlap is fixed structurally (apertures adopt the envelope's
  proven row markup), but a live visual check was blocked by a Playwright profile
  lock this session. Confirm visually when a browser is free: enter rename on an
  aperture-sidebar row and check the confirm/cancel buttons don't overlap the next
  row.

### Phase 1 (done)

- ✅ Backend: `test_sidebar_views.py` — 17 pass (roundtrip, idempotent upsert,
  delete/reset, 401 anon, 400 invalid-key/schema/oversized, 422 non-object,
  404 unknown project, user/project/sidebar scoping, repository roundtrip).
- ✅ Migration `20260716_0006` applies to dev + test DBs; head advances.
- ✅ Frontend: `sidebar_views` unit tests — 14 pass (`applySidebarOrder`,
  `useProjectSidebarViewState` load/debounce-coalesce/reset/disabled,
  `useSidebarOrganization` order + toggle-freezes-order).

### Phase 2 (done)

- ✅ `make ci` green: frontend 2186 passed incl. new `ElementSidebar.test.tsx`
  (toggle present/pressed, click toggles, manual mode renders a drag handle per
  row) + `useSidebarOrganization` `onReorder` test; aperture/envelope harnesses
  updated (mock org hook / mock `sidebar-views` fetch) and still green.
- ⚠️ Deferred: live drag reorder + persistence-across-reload in the browser
  (Playwright profile locked). Correctness of the handle/overlay stacking and the
  drag order math were verified by review.

### Phases 3–4 (done)

- ✅ Pure ops: `groups.test.ts` — 10 pass (tree build incl. claimed-item dedup +
  stale-id drop; add/rename/delete; move item; group reorder; member reorder).
- ✅ Component: `ElementSidebar.test.tsx` — 8 pass (flat manual → drag handles +
  New group; grouped → sections + Ungrouped + move selects; select reports target;
  collapse hides rows + fires toggle).
- ✅ Correctness reviewed: independent per-section DndContexts don't bleed;
  move-select round-trips; no duplicate/stale group ids; flat→tree transition clean.
- ✅ Browser-verified 2026-07-16 (via `frontend/scripts/agent-browser.mjs`):
  toggled Manual, saw the drag handles + New-group affordance, and confirmed the
  Manual setting **persists across a fresh reload** (backend round-trip). Signed
  in as `codex@example.com` on the AGENT-BROWSER fixture.
