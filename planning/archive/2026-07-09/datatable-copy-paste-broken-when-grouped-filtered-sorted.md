---
DATE: 2026-07-09
TIME: 12:05
STATUS: Resolved (2026-07-09)
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

## Resolution (2026-07-09)

**Root cause was simpler than the hypothesis above — and different.** The
keyboard paste path was *not* resolving against underlying/unsorted data
indices. `useGridClipboard` is wired on `visibleDataRows` (the
filter/sort/group-resolved subset) and `selection.range`, exactly like the
copy path and the click-drag fill hook. `coercePasteWrites` resolves
`rows[plannedWrite.rowIndex]` against that visible subset, so filter and
sort paste already worked correctly.

The single defect was a blanket guard in `DataTable.handlePasteEvent`:

```ts
if (readOnly || isGrouped) return;   // ← isGrouped short-circuited paste
```

`⌘V` is handled via the native `onPaste` event on the grid wrapper (the
keyboard hook deliberately does not intercept `⌘V`). That handler bailed
whenever a group was active, so grouped tables silently no-op'd on paste
while filtered/sorted tables were fine. The user report bundled all three
view transforms together; only **group** was actually broken.

**Fix:** dropped the `isGrouped` branch (paste resolves through
`visibleDataRows` and needs no group-specific gate), and removed the now
fully-dead `isGrouped` prop that was threaded into `useGridKeyboard` but
never read there.

**Evidence:** three new tests in `DataTable.test.tsx` — paste into a
grouped table (was failing, now passes), paste into the visually-first row
of a **sorted** table, and paste into the surviving row of a **filtered**
table (both were already green, locking in the view-resolved behavior).

**Note for dependent work** — `planning/archive/dated/2026-07-09/datatable-paste-grow-rows`
and `planning/archive/dated/2026-07-09/data-table-ui-tweaks` (item 3, marching-ants
`copiedRange`) cited this bug as evidence that the clipboard subsystem
resolves cells by visual index and must be rebuilt on stable identity. That
premise was mistaken: copy/paste/fill already track the view-resolved row
subset. A *new* `copiedRange` overlay still must store row-id + field-id
(a static index would desync), but that is a fresh requirement, not a
carry-over of this bug.

## Status

Resolved 2026-07-09. Archived to
`planning/archive/2026-07-09/datatable-copy-paste-broken-when-grouped-filtered-sorted.md`.
