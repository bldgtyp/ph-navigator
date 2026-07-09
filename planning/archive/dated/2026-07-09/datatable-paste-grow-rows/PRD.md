---
DATE: 2026-07-09
TIME: 19:56 EDT
STATUS: Complete / archived — v1 decisions resolved and verified
AUTHOR: Ed May + Claude
SCOPE: Behavior spec for paste-overflow → truncate-or-grow
RELATED: ./README.md, ./STATUS.md
---

# Paste grows the table — PRD

## Problem

A paste whose source is taller than the target's remaining rows (from the paste
anchor) aborts today (`useGridClipboard.ts:143`). Users copying a block from
Excel/AirTable into a shorter PHN table get nothing pasted.

## Desired behavior (AirTable parity)

On paste, after `planPaste(...)` computes the plan:

- **`rowsOverflow === 0`** → unchanged (paste as today).
- **`rowsOverflow > 0`** → **do not abort.** Open a modal asking how to resolve
  the overflow:

  > **This paste is bigger than the table**
  > The copied data has **N** more row(s) than the table can fit from here.
  >
  > - **Add N rows** *(primary)* — grow the table and paste everything.
  > - **Truncate** — paste only the rows that fit; drop the extra N.
  > - **Cancel** — paste nothing.

- If **Add N rows**: append N empty rows to the end of the table, then paste the
  full clipboard aligned to the anchor — as **one atomic, single-undo operation**.
- If **Truncate**: paste only the rows that fit (the current fit minus the
  overflow), write nothing to nonexistent rows.
- If **Cancel**: no-op (nothing written, no rows added).

## Implementation shape (reuse existing primitives)

- Replace the `if (plan.rowsOverflow) { onAnnounce(...); return; }` bail with a
  resolver that surfaces the modal and returns the user's choice.
- **Add-rows path:** build a single `paste` `WriteOp` that carries both the
  appended rows (in the reserved `rowsInserted` field) and the cell writes, so
  `dispatchWrite(op, inverse)` stays atomic. The inverse removes the N new rows
  (they're new → no cell-inverse needed for them) and restores prior values for
  the pre-existing rows. This is exactly what `rowsInserted` was reserved for.
- **New rows** are created with the same default/empty shape as the footer
  "+ Add row" / `insertRowBelow` path (`DataTable.tsx:515`), appended at the
  table end (paste always fills downward from the anchor, so overflow rows are
  always the bottom-most → append-at-end is correct).
- **Truncate path:** feed `planPaste` (or its writes) a clamped row count so only
  in-range rows are written; reuse the existing coerce/dispatch flow unchanged.

## Edge cases

- **Column overflow is out of scope.** Keep today's behavior (extra columns
  dropped, `useGridClipboard.ts:147`). This feature is rows only.
- **Undo/redo:** one ⌘Z reverts the whole grow+paste (rows removed + cells
  restored). Redo re-adds and re-pastes. Verify the inverse for added rows.
- **Validation failure mid-paste:** if a coerced cell is invalid after growing,
  decide whether to still add the rows or roll back entirely (recommend roll
  back — don't leave orphan empty rows if the paste can't complete).
- **Single-cell anchor vs. range anchor:** overflow is measured from the anchor
  regardless of selection size; the modal count N is `plan.rowsOverflow`.
- **Empty table / paste into last row:** N = full source height; append all.

## Interaction with grouping / sorting / filtering

Cell writes still resolve through the view-resolved visible rows. For the v1
grow path, newly-added rows use `anchorRowId: null`, matching the existing
append-at-table-end behavior in the row-insert payload builders. Under active
group / sort / filter, the inserted backing rows may land outside the current
visible view after save/refetch; this is accepted for v1.

## Resolved decisions

1. **Behavior under active group/sort/filter:** allow grow+paste and append
   generated backing rows to the table end (`anchorRowId: null`). Existing
   visible-row paste targeting remains unchanged.
2. **Remember the choice:** always show the modal for v1; no user preference.
3. **Modal copy + primary action:** title is "This paste is bigger than the
   table"; actions are `Cancel`, `Truncate`, and primary `Add N row(s)`.
4. **Backend:** slice-backed project tables compose row inserts/deletes and
   cell writes into one replace payload via `useSliceTableController`. No new
   backend endpoint was added.

## Verification

- `pnpm vitest run src/shared/ui/data-table/__tests__/DataTable.test.tsx src/shared/ui/data-table/feature/useSliceTableController.test.tsx src/shared/ui/data-table/__tests__/lib.test.ts src/shared/ui/data-table/__tests__/useGridWriteReducer.test.ts` — 99 passed. Existing `DataTable.test.tsx` `act(...)` warning remains unrelated.
- `pnpm run build` from `frontend/` — green.
- `make frontend-dev-check` — green; existing lint warnings only.
