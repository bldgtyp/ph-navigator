---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Phases 0–1 done (2026-07-15/16); Phases 2–4 remain (toggle UI + dnd-kit + groups + collapse)
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Give the two element sidebars (Apertures / Apertures and Envelope /
  Assemblies) user-controlled organization: manual drag ordering, grouping into
  a tree, and collapsible groups — persisted per-user across sessions. Phase 0
  first consolidates the two divergent sidebars into one shared component (which
  also fixes the Apertures rename-state bug).
RELATED:
  - frontend/src/features/apertures/components/ApertureSidebar.tsx
  - frontend/src/features/envelope/components/EnvelopeSidebar.tsx
  - frontend/src/features/apertures/hooks/useFramePickerFilterPreferences.ts (per-user preference pattern precedent)
  - frontend/src/shared/ui/data-table/ (grouping/filter persistence pattern to mirror)
  - planning/refactor/tooltip-hover-delays/ (sibling — sidebar tooltip parity)
  - planning/archive/dated/2026-07-15/datatable-ui-fixes/ (item 12 reorder handle — share one reorder primitive; the create-modal reorder parity is a deferred follow-up recorded there)
---

# Sidebar organization — manual order, grouping, collapse

## Read order

1. `PRD.md` — behavior contract, the three capabilities, persistence, open questions.
2. `STATUS.md` — disposition, phase map, next step.

## One-liner

Both element sidebars are always alphabetical. Let users take control: drag to
reorder, group items (e.g. all "North" apertures, all "Wall" assemblies) into a
collapsible tree, and have it persist across sessions — the way DataTable
grouping/filtering persists.

## Items folded in

- **Item 5** — the feature: manual ordering, grouping, collapsible groups; both
  sidebars; per-user persistence.
- **Item 6** — bug: the Apertures sidebar rename state renders wrong (confirm /
  cancel buttons overlap the next list item), whereas the Envelope sidebar
  renders correctly. Folded in as **Phase 0**: consolidating the two sidebars
  into one shared component is the natural fix and the right foundation for
  everything in item 5.

## Why one packet

Items 5 and 6 both stem from the same root: `ApertureSidebar` and
`EnvelopeSidebar` are parallel, divergent implementations. Building ordering +
grouping + collapse **twice** would compound that divergence. Consolidate first
(Phase 0, which incidentally fixes the rename bug), then build the new
capabilities once in the shared component.
