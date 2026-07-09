# STATUS — datatable-paste-grow-rows

**State:** ✅ Implemented — focused DataTable tests, frontend build, graphify,
simplify, docs-pass, and `make frontend-dev-check` are green. Ready for archive
cleanup.

**Ask:** when a paste source is taller than the target from the anchor
(`plan.rowsOverflow > 0`), replace today's abort with a modal — **truncate** or
**add N rows then paste** — for AirTable parity. Growing must be one atomic,
single-undo operation.

## Foundation (already exists — this feature wires it together)

- `planPaste` → `rowsOverflow` (`lib/paste/plan.ts:40`).
- `paste` `WriteOp.rowsInserted` reserved slot (`types.ts`) — currently `[]`.
- `rowInsert` `WriteOp` + `insertRowBelow` (`DataTable.tsx:515`) for row append + undo.

## Decisions

- Group/sort/filter: allow grow+paste; inserted backing rows use
  `anchorRowId: null` and may land outside the current transformed view after
  save/refetch.
- Remember-choice policy: always show the modal for v1.
- Modal copy: title "This paste is bigger than the table"; actions `Cancel`,
  `Truncate`, primary `Add N row(s)`.
- Backend: no new endpoint; slice-backed tables compose paste row inserts /
  deletes and cell writes into one replace payload.

## Checklist

- [x] Document the feature + reuse the existing paste/row-insert primitives.
- [x] Decide group/sort/filter behavior (open decision #1).
- [x] Confirm modal copy + primary action (#3) and remember-choice policy (#2).
- [x] Modal component (truncate / add-rows / cancel).
- [x] `useGridClipboard`: replace the `rowsOverflow` abort with the resolver.
- [x] Atomic grow+paste `WriteOp` (populate `rowsInserted`) + inverse for undo.
- [x] Truncate path (clamped row count).
- [x] Verify: fits / truncate / add-rows; slice-controller single-payload
      composition; frontend build.
- [x] Closeout gate: `simplify` → `docs-pass` → format/checks as needed.

## Verification

- `pnpm vitest run src/shared/ui/data-table/__tests__/DataTable.test.tsx src/shared/ui/data-table/feature/useSliceTableController.test.tsx src/shared/ui/data-table/__tests__/lib.test.ts src/shared/ui/data-table/__tests__/useGridWriteReducer.test.ts` — 99 passed; existing unrelated `act(...)` warning in `DataTable.test.tsx`.
- `pnpm run build` from `frontend/` — green.
- `pnpm exec prettier --write ...` on touched frontend files.
- `graphify update .` — graph updated; HTML viz skipped because graph exceeds
  node limit.
- `make frontend-dev-check` — green; existing lint warnings only
  (`react-refresh/only-export-components` in unrelated files).
