# STATUS — data-table-ui-tweaks

**State:** 🟡 Active — Items 1–3 implemented. Running list;
Ed is still adding items from a live grid review (2026-07-09).

**Branch:** `codex/data-table-ui-tweaks`. One commit per item (precedent:
`attachment-cell-ux`).

## Item tracker

| # | Item | State | Next step |
|---|------|-------|-----------|
| 1 | Active-cell highlight ladder (crisp single ring, square corners, kill editor-radius corner spots) | ✅ Implemented | Active/error rings now render as square overlay pseudo-elements; editor radius is reset inside the grid |
| 2 | Toolbar Filter/Sort/Group white-pill on active | ✅ Implemented | `.data-table-toolbar-button span` now resets border/background/padding/radius so active axis buttons render as one flat tint |
| 3 | Copy/paste feedback: marching ants + Esc-clear + paste flash | ✅ Implemented | Copied ranges are stored as stable row-id/field-key endpoints, projected onto the current visible range, and cleared on Esc, paste, or source row updates |

## Cross-links

- Item 3 shares the copy/paste subsystem with the now-**resolved** bug
  `planning/archive/2026-07-09/datatable-copy-paste-broken-when-grouped-filtered-sorted.md`.
  That bug was a stray group-only paste guard, **not** a cell-resolution
  desync — copy/paste/fill already track view-resolved rows, so there is no
  bug to fix first. The `copiedRange` overlay must still track stable
  row/field identity (not visual index) or it will desync under
  group/filter/sort; that is a fresh requirement for the new overlay, not a
  carry-over.

## Verification (per item)

Grid chrome is visual — verify in the running app, not just CSS:

1. Screenshot each cell state on ≥2 tables (Spaces/Rooms + a catalog):
   rest / row-hover / block-selected / active / active-editing / error.
   Item 1 code verification: `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/GridBody.test.tsx src/shared/ui/data-table/__tests__/DataTable.test.tsx src/shared/ui/data-table/__tests__/numberUnitsGrid.test.tsx`
   (100 passed, 2026-07-09; existing `act(...)` stderr warnings only).
   Item 1 browser verification: Rooms active cell computed `::before` border
   `2px solid rgb(45, 107, 128)`, radius `0px`, `box-shadow: none`; Rooms
   edit mode kept the same ring and computed `.data-table-cell-editor`
   `border-radius: 0px`; Materials catalog active frozen cell kept the same
   square `::before` ring while preserving the frozen-column `::after` shadow.
   Simplify follow-up raised the fill handle and single-select chevron above
   the overlay ring (`z-index: 4` vs ring `3`), removed the redundant active
   error shadow override, and gives active error cells a slightly stronger
   danger fill instead of reintroducing a halo.
   Item 1 gate: `make format`, `graphify update .`, and `make ci` passed
   (2026-07-09). CI emitted existing frontend lint warnings and existing
   Vitest stderr noise, but no failures.
2. Toolbar: inactive / hover / active for Filter, Sort, Group, Hide-fields.
   Item 2 code verification: `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/GridToolbar.test.tsx`
   (19 passed, 2026-07-09). Live screenshot verification remains part of the
   packet closeout because this item is visual CSS.
   Item 2 gate: `make format`, `graphify update .`, and `make ci` passed
   (2026-07-09). CI emitted existing frontend lint warnings and existing
   Vitest stderr noise, but no failures.
3. Copy/paste: ⌘C shows ants; Esc clears; ⌘V flashes target; ants track
   correctly after applying a group AND a sort AND a filter.
   Item 3 code verification: `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/DataTable.test.tsx src/shared/ui/data-table/__tests__/GridBody.test.tsx src/shared/ui/data-table/__tests__/useGridKeyboard.test.ts`
   (119 passed, 2026-07-09; existing `act(...)` stderr warning in the older
   no-op inline edit test only). `make frontend-dev-check` passed after the
   timer/`CellRange` type fixes (2026-07-09), with the repo's existing 15
   frontend lint warnings.
   Item 3 browser verification: Rooms route copied active frozen cell produced
   `td[data-copied-cell="true"]`, `::before` repeating-gradient marching-ant
   edge backgrounds, and retained the active `2px solid` square ring; Esc
   cleared copied cells (`0` remaining); paste set `data-just-pasted="true"`
   and `animation-name: data-table-paste-flash` on the target cell.
4. Closeout gate per item/merge: `simplify` → `docs-pass` → `make format`
   → `make ci`.

## Checklist

- [x] Document items 1–3 (this packet).
- [x] Item 2 (no open decisions — smallest, do first).
- [x] Item 1 (confirm ring approach with Ed).
- [x] Copy/paste bug fix (resolved earlier as grouped/filter/sort paste guard).
- [x] Item 3 (marching ants + paste flash).
- [ ] Append further review items as Ed reports them.
