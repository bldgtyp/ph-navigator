# STATUS — datatable-paste-grow-rows

**State:** 🟡 Requested — scoped, **not started**. Behavior is defined; a few
open decisions (grouped/sorted/filtered handling, remember-choice, modal copy)
before implementation. See `PRD.md`.

**Ask:** when a paste source is taller than the target from the anchor
(`plan.rowsOverflow > 0`), replace today's abort with a modal — **truncate** or
**add N rows then paste** — for AirTable parity. Growing must be one atomic,
single-undo operation.

## Foundation (already exists — this feature wires it together)

- `planPaste` → `rowsOverflow` (`lib/paste/plan.ts:40`).
- `paste` `WriteOp.rowsInserted` reserved slot (`types.ts`) — currently `[]`.
- `rowInsert` `WriteOp` + `insertRowBelow` (`DataTable.tsx:515`) for row append + undo.

## Next step

Resolve open decision #1 (behavior under active group/sort/filter), then
confirm modal copy (#2, #3) with Ed. The copy/paste-view bug this once
sequenced behind is **resolved**
(`planning/archive/2026-07-09/datatable-copy-paste-broken-when-grouped-filtered-sorted.md`);
it turned out to be a stray group-only paste guard, not a cell-resolution
desync, so it no longer blocks or informs this decision.

## Checklist

- [x] Document the feature + reuse the existing paste/row-insert primitives.
- [ ] Decide group/sort/filter behavior (open decision #1).
- [ ] Confirm modal copy + primary action (#3) and remember-choice policy (#2).
- [ ] Modal component (truncate / add-rows / cancel).
- [ ] `useGridClipboard`: replace the `rowsOverflow` abort with the resolver.
- [ ] Atomic grow+paste `WriteOp` (populate `rowsInserted`) + inverse for undo.
- [ ] Truncate path (clamped row count).
- [ ] Verify: fits / truncate / add-rows; undo/redo; batched single-save;
      and behavior under group + sort + filter.
- [ ] Closeout gate: `simplify` → `docs-pass` → `make format` → `make ci`.
