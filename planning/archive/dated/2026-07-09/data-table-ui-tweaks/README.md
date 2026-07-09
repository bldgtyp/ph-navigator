---
DATE: 2026-07-09
TIME: 12:20 EDT
STATUS: Complete
AUTHOR: Ed May + Claude
SCOPE: Cross-cutting visual polish of the shared DataTable grid chrome —
       cell-state highlight treatment (rest / selected / active / active-input /
       block), toolbar Filter/Sort/Group active-state styling, and clipboard
       feedback. All fixes land in the shared grid, so they apply to every
       DataTable surface.
RELATED: context/UI_UX.md §0/§1 (DataTable model, common elements),
         feedback_datatable_uniformity_ironlaw,
         frontend/src/shared/ui/data-table/DataTable.css,
         frontend/src/shared/ui/data-table/DataTable.tsx,
         frontend/src/shared/ui/data-table/components/GridBody.tsx,
         frontend/src/shared/ui/data-table/components/GridToolbar.tsx,
         frontend/src/shared/ui/data-table/hooks/useGridClipboard.ts,
         frontend/src/shared/ui/data-table/hooks/useGridKeyboard.ts,
         frontend/src/styles/reset.css (global input radius — item 1 root cause)
---

# Refactor — DataTable UI Tweaks

Completed packet of visual-polish tweaks to the shared **DataTable** grid,
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
| 3 | Copy/paste feedback: marching ants, Esc clear, paste flash | grid clipboard feedback | Missing affordance | Clipboard copy wrote TSV/HTML but left no copied-range state or target-cell paste feedback | No |

> Completed scope: items 1-3. Future grid review items should get a fresh
> packet or explicit follow-up entry rather than reopening this archive.

## Blast radius

`DataTable.css`, `GridToolbar.tsx`, `GridBody.tsx`, `DataTable.tsx`, and the
shared clipboard/keyboard hooks are shared grid plumbing. These items render on
**every** DataTable in the app. Verify at least two surfaces after each fix
(e.g. Spaces/Rooms + a catalog table) since the visual system is identical
across all of them.

## Working discipline

One item at a time, each on its own commit off a shared feature branch.
Closeout gate (`simplify` → `docs-pass` → `make format` → `make ci`) runs per
item or per merge. Grid chrome is visual — verify in the real app (screenshot
each state: rest / hover / selected-block / active / active-editing / error),
not just by reading CSS.
