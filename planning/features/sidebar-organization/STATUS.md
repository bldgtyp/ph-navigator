---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Phases 0–1 done; Phases 2–4 (toggle UI + dnd-kit + groups + collapse) remain
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Disposition + phase map for sidebar-organization.
RELATED: ./README.md; ./PRD.md
---

# STATUS — Sidebar organization

**State:** Phase 0 implemented (2026-07-15) on a feature branch, pending commit.
Phases 1–4 (the new capabilities) are still unscoped and blocked on Ed's
persistence-store decision (open Q #1) — he wants to take those slowly.

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
- **Phase 2 — Manual ordering (G1) + sort-mode toggle.** Wire
  `useSidebarOrganization` into both adapters (adds a `projectId` prop), render the
  alphabetical | manual toggle in the shared sidebar header, and add **dnd-kit**
  drag handles to reorder + persist. Shares the dnd-kit primitive with the
  single-select field-editor reorder handle (batch item 12).
- **Phase 3 — Grouping (G2).** Group create/assign/reorder + tree render +
  persist (extends the same persisted document: `groups`).
- **Phase 4 — Collapse (G3).** Per-group collapse/expand + persist
  (`collapsed_group_ids`).

## Next step

Phase 2: wire `useSidebarOrganization` into `ApertureSidebar`/`EnvelopeSidebar`
(thread `projectId` from the parents), render the sort-mode toggle in
`ElementSidebar`, and add dnd-kit drag. This touches the aperture/envelope test
harnesses (they'll need a `projectId` + a mocked `sidebar-views` fetch), so budget
for that churn.

## Blockers

- None. Open Q #1 (persistence store) and #4 (reorder primitive) resolved by Ed
  2026-07-15. Remaining UX details (open Qs #2/#3/#5) resolve inside Phases 2–3.

## Deploy note

This feature branch must merge as a **bundle** (Phases 1–4 together), not
mid-feature: Phase 1 ships no user-visible change, and a Phase-2 toggle is
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

### Phases 2–4 (when built)

- Browser: manual order + a group survive a reload and a fresh session
  (sign in as Ed — the seed project is owned by ed@example.com).
- Both sidebars exercised identically (shared component).
