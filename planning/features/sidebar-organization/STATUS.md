---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Active
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Disposition + phase map for sidebar-organization.
RELATED: ./README.md; ./PRD.md
---

# STATUS — Sidebar organization

**State:** Active — captured and synthesized from the 2026-07-15 UI batch. Not
yet scoped to detailed phases; Ed wants to take this one slowly.

## Phase map (proposed)

- **Phase 0 — Consolidate sidebars.** Merge `ApertureSidebar` + `EnvelopeSidebar`
  into one shared component; fix the Apertures rename-state overlap bug (Item 6)
  in the process. No new capabilities yet. *This phase is independently
  shippable and fixes a live bug — good first slice.*
- **Phase 1 — Persistence foundation.** Decide + build the per-user persisted
  state store (reuse DataTable view-state mechanism if server-side). Wire an
  empty sort-mode toggle (alphabetical | manual).
- **Phase 2 — Manual ordering (G1).** Drag handles + reorder + persist.
- **Phase 3 — Grouping (G2).** Group create/assign/reorder + tree render +
  persist.
- **Phase 4 — Collapse (G3).** Per-group collapse/expand + persist.

## Next step

Resolve PRD open question #1 (persistence store + scope) with Ed, and confirm how
DataTable view state persists today so Phase 1 reuses it. Then scope Phase 0 in
detail (it can start before the persistence decision, since consolidation +
rename fix don't need new persistence).

## Blockers

- None hard. Phase 1+ waits on the persistence-store decision (open Q #1).

## Verification (when built)

- Browser: manual order + a group survive a reload and a fresh session
  (sign in as Ed — the seed project is owned by ed@example.com).
- Both sidebars exercised identically (shared component).
- Rename state no longer overlaps the adjacent row (Item 6 regression check).
