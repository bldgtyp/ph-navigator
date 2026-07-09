---
DATE: 2026-07-09
TIME: 19:54 EDT
STATUS: Implemented — focused tests + frontend gate green
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
         planning/archive/dated/2026-07-09/data-table-ui-tweaks/ (item 3: paste feedback)
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

## Implemented behavior

`useGridClipboard.ts` now replaces the old `rowsOverflow` abort with a modal
resolver:

- **Add N rows** appends generated rows with the overflow clipboard values
  encoded into `rowInsert.fieldDefaults`, then dispatches one semantic `paste`
  `WriteOp`.
- **Truncate** keeps the fitting writes only.
- **Cancel** writes nothing.

The v1 modal always appears for row overflow; no remembered preference is
persisted.

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

Shared grid clipboard path → applies to every editable DataTable. Focused
component coverage verifies truncate and add-rows; slice-controller coverage
verifies row inserts + cell writes compose into one replace payload.
