---
DATE: 2026-07-09
TIME: 12:20 EDT
STATUS: Active
AUTHOR: Ed May + Claude
SCOPE: Cross-cutting visual polish of the shared DataTable grid chrome —
       cell-state highlight treatment (rest / selected / active / active-input /
       block) and the toolbar Filter/Sort/Group active-state styling. All fixes
       land in the shared grid, so they apply to every DataTable surface.
RELATED: context/UI_UX.md §0/§1 (DataTable model, common elements),
         feedback_datatable_uniformity_ironlaw,
         frontend/src/shared/ui/data-table/DataTable.css,
         frontend/src/shared/ui/data-table/components/GridToolbar.tsx,
         frontend/src/styles/reset.css (global input radius — item 1 root cause)
---

# Refactor — DataTable UI Tweaks

Running packet of visual-polish tweaks to the shared **DataTable** grid,
driven by hands-on review (2026-07-09). These are appearance/interaction
refinements on an existing shared component — no new product capability —
so this lives in `planning/refactor/` per `planning/.instructions.md` rule 3.

Because every fix is in `DataTable.css` / the shared toolbar, each one lands
**uniformly across all table surfaces** (Spaces/Rooms, Equipment/Ventilators,
Materials & Glazing catalogs, Apertures spec-report, etc.) — this is the
DataTable uniformity iron-law working in our favor
([[feedback_datatable_uniformity_ironlaw]]).

## Read order

1. `PRD.md` — each item with root-cause (file:line), the fix, the target
   design, blast radius, and any open decision.
2. `STATUS.md` — per-item phase tracker; current focus and next step.

## Items (summary)

| # | Item | Surface | Type | Root cause | Open decision? |
|---|------|---------|------|-----------|----------------|
| 1 | Active-cell highlight looks bad — faint muddy border + corner "spots"; refine the whole cell-state ladder | grid cells | Redesign | Double box-shadow ring (2px hard + 4px faint halo) reads muddy; editor `<input>` keeps global `--radius-xs` (4px) over an `overflow:hidden` td → rounded corners reveal the ring at corners | Design direction (proposed) |
| 2 | Toolbar Filter/Sort/Group active buttons show a white pill behind icon+label instead of a single flat color | grid toolbar | Bug/UX | Broad `.data-table-toolbar span` rule paints `background: var(--bg-card)` on the icon+label spans; the button-scoped reset only clears `border`, not `background` | No |

> This is a **running list** — Ed is adding items as he reviews the grid.
> Append new rows here + a section in `PRD.md` + a tracker line in `STATUS.md`.

## Blast radius

`DataTable.css` and `GridToolbar.tsx` are the shared grid. Both items render
on **every** DataTable in the app. Verify at least two surfaces after each fix
(e.g. Spaces/Rooms + a catalog table) since the visual system is identical
across all of them.

## Working discipline

One item at a time, each on its own commit off a shared feature branch.
Closeout gate (`simplify` → `docs-pass` → `make format` → `make ci`) runs per
item or per merge. Grid chrome is visual — verify in the real app (screenshot
each state: rest / hover / selected-block / active / active-editing / error),
not just by reading CSS.
