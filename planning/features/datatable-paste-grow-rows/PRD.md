---
DATE: 2026-07-09
TIME: 12:58 EDT
STATUS: Requested — scoped, not started
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

## ⚠️ Interaction with grouping / sorting / filtering

Appending rows while a **group / sort / filter** is active is the fraught case:
new rows need a defined landing spot (which group? what sort position? do they
pass the active filter?). This shares risk with the open bug
`planning/bugs/datatable-copy-paste-broken-when-grouped-filtered-sorted.md`
(paste cell-resolution desyncs under view transforms). **Open decision below.**

## Open decisions

1. **Behavior under active group/sort/filter:** (a) allow grow+paste and append
   new rows to the table end with default group membership (may jump out of the
   current filtered view), (b) require clearing group/sort/filter before a
   growing paste, or (c) gate this feature on the copy/paste-view bug being
   fixed first. Recommend (c)+(a): fix the view-resolution bug, then append to
   end with default membership and announce where they landed.
2. **Remember the choice?** AirTable just auto-grows. Do we offer a
   "don't ask again / always add rows" preference, or always show the modal for
   v1? Recommend always-show for v1 (explicit, low-risk), revisit later.
3. **Modal copy + primary action** — confirm wording and that **Add rows** is
   the default/primary button (matches the AirTable expectation of growing).
4. **Backend:** row insertion already rides the existing `WriteOp`/document-save
   path (add-row works today), so no new backend endpoint is expected — confirm
   the batched N-row append persists in one save, not N round-trips.
