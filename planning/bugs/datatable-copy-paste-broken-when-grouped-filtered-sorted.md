---
DATE: 2026-07-09
TIME: 12:05
STATUS: Open
AUTHOR: Ed May (reported), Claude (recorded)
SCOPE: DataTable — cell copy/paste when a GROUP, FILTER, or SORT is applied
RELATED:
  - feedback_datatable_uniformity_ironlaw
  - context/UI_UX.md
---

# DataTable: keyboard copy/paste (⌘C/⌘V) breaks when GROUP / FILTER / SORT is applied

## Summary

On DataTables, **cell-to-cell copy/paste via ⌘C / ⌘V stops working whenever the
table has a GROUP, FILTER, or SORT applied.** With no group/filter/sort, keyboard
copy/paste works normally.

## Observed behavior

- **Broken:** ⌘C (copy) then ⌘V (paste) from one cell to another does **not**
  work while a GROUP, FILTER, or SORT is active on the table.
- **Works:** the same copy/paste works fine when no group/filter/sort is applied.
- **Works (important clue):** mouse "fill"/propagate by click-drag **DOES** still
  work even when grouped/filtered/sorted — only the keyboard ⌘C/⌘V path is broken.

## Expected behavior

Cell-to-cell keyboard copy/paste should work **regardless** of whether a group,
filter, or sort is applied. Grouping/filtering/sorting is a view transform and
should not disable a basic cell affordance.

## Why it matters

This is a basic, universally-expected DataTable affordance failing under a common
view state (grouped/filtered/sorted tables are the norm, not the exception). It
falls under the DataTable uniformity iron-law
([[feedback_datatable_uniformity_ironlaw]]): basic affordances must hold uniformly,
not silently drop out under certain view states.

## Hypothesis / where to look

The split between the two paths is the key: **click-drag fill works, ⌘C/⌘V does
not.** That suggests the drag/fill handler resolves the source/target cell from
the *rendered/visual* rows correctly, but the keyboard copy/paste handler is
resolving cell coordinates against the **unfiltered/ungrouped/unsorted underlying
data indices** — so when a view transform reorders or hides rows, the ⌘C/⌘V
handler maps to the wrong (or a nonexistent) cell and no-ops.

Look at the DataTable keyboard copy/paste handler and how it maps the active
selection to a data row — compare against how the click-drag fill handler resolves
the same, since that one respects the current view.

## Repro

1. Open a project → any DATA-TABLE with editable cells.
2. Apply a GROUP (or a FILTER, or a SORT).
3. Select a cell, press ⌘C, select another cell, press ⌘V → paste does nothing.
4. Remove the group/filter/sort → ⌘C/⌘V works again.
5. With the group/filter/sort re-applied, confirm click-drag fill still works
   (isolates the failure to the keyboard path).

## Status

Open — not yet triaged or fixed. Recorded from user report.
