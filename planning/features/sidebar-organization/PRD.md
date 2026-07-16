---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Draft — behavior captured, not scoped to phases in detail
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Behavior contract for user-controlled sidebar organization across the
  Apertures and Envelope/Assemblies sidebars.
RELATED: ./README.md; ./STATUS.md
---

# PRD — Sidebar organization

## Problem

The Apertures sidebar (Aperture Types) and the Envelope sidebar (Assemblies) are
always sorted alphabetically. That works but is rigid: on real projects with many
elements, users can't group related items (by orientation, by assembly family)
or arrange them in a working order, and long flat lists get unwieldy.

Separately, the two sidebars are **divergent implementations** of the same
concept, and one of them (Apertures) has a rename-state layout bug the other does
not.

## Goals

Give users, in **both** sidebars, three layered capabilities — all persisted
per-user across sessions (same expectation as DataTable grouping/filtering):

### G1 — Manual ordering
- Add a "manual order" mode (vs. the current alphabetical).
- In manual mode, each row shows the standard **6-dot drag handle**; the user
  drags rows up/down to set order.
- Order persists across sessions.

### G2 — Grouping (tree)
- The user can define groups and assign items to them (e.g. "North" apertures;
  "Wall" assemblies). The sidebar becomes a **tree**: groups containing items.
- Group membership + group order persist.

### G3 — Collapsible groups
- Each group can be collapsed / expanded ("roll up") so large lists stay
  manageable. Collapsed/expanded state persists.

## Non-goals (for now)

- Auto-grouping by a computed attribute (e.g. auto-bucket by orientation). Groups
  are user-defined in v1; smart/auto groups are a possible later enhancement.
- Sharing a user's custom order/groups with other users on the project (this is
  per-user view state, not shared project data — unless Ed decides otherwise; see
  open questions).

## Phase 0 — Consolidate the two sidebars (absorbs Item 6)

Before adding capabilities, unify `ApertureSidebar` and `EnvelopeSidebar` into
one shared sidebar component (parameterized by item type / actions). This:

- Fixes **Item 6**: the Apertures rename state (confirm/cancel buttons overlap
  the next row) — the Envelope sidebar already renders rename correctly, so the
  shared component adopts that behavior.
- Gives ordering/grouping/collapse a single home instead of two.
- Pairs naturally with the tooltip-parity half of
  [`tooltip-hover-delays`](../../refactor/tooltip-hover-delays/README.md) item 10.
- **Extract the shared row-action button.** The tooltip-hover-delays refactor
  (merged first) left both sidebars carrying a near-identical local
  `SidebarActionButton` (icon button wrapped in `<Tooltip … hoverDelay={long}>`).
  They differ only cosmetically today (CSS class prefix; envelope takes an `id`
  and calls `preventDefault`). Consolidating the sidebars should fold these into
  one shared `TooltipIconButton`/`SidebarActionButton` in `shared/ui`
  (parameterized by `className`/`id`). Deliberately deferred out of the tooltip
  refactor to avoid a premature abstraction over two still-diverging call sites.

## Persistence

Model the persisted state on the existing per-user preference pattern
(`useFramePickerFilterPreferences.ts`) and the DataTable grouping/filter
persistence. State to persist, per user, per sidebar (per project? — see open
Qs):

- sort mode (alphabetical | manual)
- manual order (ordered list of item ids)
- group definitions (id, label, ordered member item ids, order among groups)
- per-group collapsed/expanded flag

**Open decision:** localStorage vs. backend-backed. This state is structural and
valuable (a user re-grouping 200 assemblies does not want to lose it on a new
device). Leaning **backend-backed per-user setting**, but confirm against how
DataTable view state persists today (it may already be server-side) so we reuse
one mechanism rather than inventing a second.

## Open questions

1. **Persistence store + scope.** Backend vs. local; per-project vs. global;
   per-user vs. shared. (Recommend: backend, per-user, per-project.)
2. **New items' placement.** When a new aperture/assembly is created while in
   manual/grouped mode, where does it land — top, bottom, or an "Ungrouped"
   bucket?
3. **Groups when switched back to alphabetical.** Do groups persist but flatten,
   or are groups only meaningful in manual mode?
4. **Reorder primitive.** Share one drag-reorder implementation with the
   single-select field-editor reorder handle (item 12) — pick a library or a
   small in-house primitive once.
5. **Empty groups.** Allowed? Auto-removed when last item leaves?

## Acceptance (high level — refine when scoped)

- A user can switch a sidebar to manual mode, drag items into a preferred order,
  and see that order preserved after reload / next session.
- A user can create a group, move items into it, collapse it, and see all of that
  preserved across sessions.
- Both sidebars behave identically (shared component); rename state no longer
  overlaps the next row.
