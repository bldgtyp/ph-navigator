---
DATE: 2026-07-09
TIME: 12:58 EDT
STATUS: Requested — scoped, not started
AUTHOR: Ed May + Claude
SCOPE: DataTable paste — when the clipboard source has more rows than the
       target table can hold from the paste anchor, prompt the user to either
       truncate the paste or grow the table (auto-add rows, then paste).
       AirTable feature parity.
RELATED: frontend/src/shared/ui/data-table/hooks/useGridClipboard.ts,
         frontend/src/shared/ui/data-table/lib/paste/plan.ts,
         frontend/src/shared/ui/data-table/DataTable.tsx (insertRowBelow),
         frontend/src/shared/ui/data-table/types.ts (WriteOp: paste / rowInsert),
         planning/archive/2026-07-09/datatable-copy-paste-broken-when-grouped-filtered-sorted.md,
         planning/refactor/data-table-ui-tweaks/ (item 3: paste feedback)
---

# Feature — Paste grows the table (truncate vs. add-rows modal)

## One-liner

Multi-row paste from Excel / AirTable already works when the source fits the
target. When the **source has more rows than the target table can hold from the
paste anchor**, paste currently **aborts**. For AirTable parity, prompt the user:
**truncate the paste**, or **add new rows** to the table — and if they choose to
grow, auto-append the needed rows, then paste the full source.

## Why this is a `feature/`, not a `bug/` or `refactor/`

It adds a new product capability (a paste-overflow decision + table-growth
semantics + a modal), not just polish or a defect fix. It's the AirTable-parity
behavior the grid doesn't have yet.

## Current behavior (the gap)

`useGridClipboard.ts:143-145` — when `planPaste(...)` reports `rowsOverflow > 0`,
paste bails with a screen-reader announce ("Clipboard has N more rows. Add rows
before paste.") and writes nothing. That's the exact stop this feature replaces.

## Foundation already in place

This is mostly wiring primitives that already exist:

- `planPaste` already computes `rowsOverflow` (`lib/paste/plan.ts:40`).
- The `paste` `WriteOp` already reserves a `rowsInserted: unknown[]` field
  (`types.ts`) — currently always `[]`; this feature is what populates it so a
  single ⌘Z reverts both the added rows and the pasted cells.
- A `rowInsert` `WriteOp` kind + `insertRowBelow` (`DataTable.tsx:515`) already
  implement row append with undo.

## Read order

1. `PRD.md` — behavior spec, the modal, the atomic grow+paste op, edge cases,
   open decisions.
2. `STATUS.md` — state + next step.

## Blast radius

Shared grid clipboard path → applies to every editable DataTable. Verify on a
plain table and on a grouped/sorted/filtered table (see the PRD interaction note
and the cross-referenced copy/paste bug).
