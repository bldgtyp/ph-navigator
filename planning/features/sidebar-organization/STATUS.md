---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Phase 0 done; Phases 1–4 blocked on persistence decision
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
- **Phase 1 — Persistence foundation.** Decide + build the per-user persisted
  state store (reuse DataTable view-state mechanism if server-side). Wire an
  empty sort-mode toggle (alphabetical | manual).
- **Phase 2 — Manual ordering (G1).** Drag handles + reorder + persist.
- **Phase 3 — Grouping (G2).** Group create/assign/reorder + tree render +
  persist.
- **Phase 4 — Collapse (G3).** Per-group collapse/expand + persist.

## Next step

Resolve PRD open question #1 (persistence store + scope) with Ed, and confirm how
DataTable view state persists today so Phase 1 reuses it. Phase 1 cannot start
until that decision lands.

## Blockers

- **Phase 1+ blocked** on the persistence-store decision (open Q #1) — Ed's call.
  Phase 0 was independently shippable and is done.

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

### Phases 1–4 (when built)

- Browser: manual order + a group survive a reload and a fresh session
  (sign in as Ed — the seed project is owned by ed@example.com).
- Both sidebars exercised identically (shared component).
