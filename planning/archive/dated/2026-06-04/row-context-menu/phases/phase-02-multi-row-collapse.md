---
DATE: 2026-06-04
TIME: 16:30
STATUS: Done — landed 2026-06-04 on main
AUTHOR: Ed May / Claude
SCOPE: Multi-row Delete collapse rules (PRD §5 rules 1–3). Reuse
       existing `deleteSelectedRows`. No new endpoints.
RELATED:
  - planning/features/row-context-menu/PRD.md §5
  - planning/features/row-context-menu/decisions.md D-5, D-5b
  - planning/features/row-context-menu/phases/phase-01-row-context-menu-shell.md
  - frontend/src/shared/ui/data-table/hooks/useGridRowSelection.ts
  - frontend/src/shared/ui/data-table/DataTable.tsx (deleteSelectedRows)
---

# Phase 2 — Multi-row Delete collapse

## P0. Why this slice

Phase 1 ships a single-row menu. Phase 2 adds the **multi-select
collapse branch**: when 2+ rows are checkbox-selected and the user
right-clicks a row in the selection, the menu shows only
`Delete N records` and reuses the existing `deleteSelectedRows`
path. When they right-click a row outside the selection, the
selection is cleared and the menu collapses back to single-row mode.

This phase is small but contract-bearing — every later phase
(Duplicate, rowActions) inherits the collapse rules, so getting the
state-machine and the announce-text right here pays back later.

## P1. Acceptance — Phase 2 done when

1. With 2+ rows checkbox-selected and the user right-clicks a row
   in the selection, the menu shows **exactly one item**:
   `Delete N records` (with the danger tint), and clicking it
   invokes `deleteSelectedRows`. The menu's `aria-label` is
   `Selected rows actions`.
2. With 2+ rows checkbox-selected and the user right-clicks a row
   **not** in the selection, the selection is cleared, and the
   single-row four-item menu (Insert / Duplicate-stub / Expand /
   Delete — Duplicate lands in 3a) opens against the right-clicked
   row.
   - Note: Duplicate may be absent in this phase; that's fine, the
     test asserts the present items only.
3. With 0 or 1 row selected, the menu opens against the right-
   clicked row with no collapse behavior change vs Phase 1.
4. `selectionCount` and `rowIsInSelection` are read at right-click
   time and **frozen** for the menu's lifetime (verified by an
   assertion in the unit test: toggling a checkbox after open does
   not change the menu's branch).
5. The live-region announce on collapsed delete says
   `"{N} rows deleted."` (reuses the existing `setAnnounce` text
   from `deleteSelectedRows`).
6. ⌘Z after a collapsed delete restores the full deleted set
   (already true via existing `deleteSelectedRows` → `rowDelete`
   inverse).
7. `make ci` is green; new Playwright e2e cases cover the rule-1
   and rule-2 branches in `frontend/tests/e2e/row-context-menu-
   multi-row.spec.ts`.

## P2. Files

### New

- `frontend/tests/e2e/row-context-menu-multi-row.spec.ts`

### Modified

- `frontend/src/shared/ui/data-table/components/RowContextMenu.tsx`
  — add the collapsed-branch render path; freeze
  `selectionCount` / `rowIsInSelection` into the `open` state at
  right-click time.
- `frontend/src/shared/ui/data-table/DataTable.tsx` — at the
  `contextmenu` handler, snapshot the selection summary
  (`rowSelection.count`, `rowSelection.isSelected(rowId)`) and pass
  it to the menu opener. Wire `onDeleteSelection` →
  `deleteSelectedRows` (already exists). Implement the rule-2
  selection clear via `rowSelection.clear()`.
- `frontend/src/shared/ui/data-table/__tests__/RowContextMenu.test.tsx`
  — extend with rule-1 / rule-2 / rule-3 cases.

## P3. State machine

The menu's `open` state carries the frozen snapshot:

```ts
type OpenState = {
  rowId: string;
  rowNumber: number;
  x: number;
  y: number;
  activeIndex: number;
  // Frozen at right-click time — PRD §5 render-perf contract.
  selectionCount: number;
  rowIsInSelection: boolean;
};
```

At `contextmenu`:

```ts
const count = rowSelection.count;
const inSel = rowSelection.isSelected(rowId);

if (count >= 2 && !inSel) {
  rowSelection.clear();            // rule 2 — D-5b irreversibility
  // Then open with the freshly-cleared snapshot.
  openRowMenu({ rowId, x, y, selectionCount: 0, rowIsInSelection: false });
} else {
  openRowMenu({ rowId, x, y, selectionCount: count, rowIsInSelection: inSel });
}
```

The menu component derives its branch from
`selectionCount >= 2 && rowIsInSelection` — true → collapsed; false
→ full menu.

## P4. Sequence

1. Add the `OpenState` freezing to `RowContextMenu.tsx`.
2. In `DataTable.tsx`, snapshot the selection summary at the
   `contextmenu` handler and implement the rule-2 clear.
3. Add the collapsed-branch render path to `RowContextMenu.tsx`
   (one item, danger styling, `Selected rows actions` aria-label).
4. Wire `onDeleteSelection` to `deleteSelectedRows` (already exists
   in `DataTable.tsx`).
5. e2e for rule 1 and rule 2.

## P5. Tests

### Vitest

- Rule 1: mount with 3 rows selected, right-click row #2 (in
  selection). Assert one item `Delete 3 records`, danger tint,
  `aria-label="Selected rows actions"`.
- Rule 2: mount with 3 rows selected, right-click row #5 (not in
  selection). Assert selection is cleared and the menu opens with
  the full item list against row #5.
- Rule 3: mount with 0 or 1 row selected, right-click any row.
  Assert full menu opens; selection state is untouched.
- Render-perf freeze: mount with 3 rows selected, right-click row
  #2 (rule 1 path), then toggle row #2's checkbox via a programmatic
  call. Assert the menu's rendered branch does not flip back to the
  full menu.

### Playwright e2e — `row-context-menu-multi-row.spec.ts`

- Materials catalog with 3 rows checkbox-selected. Right-click one
  of them; assert the menu shows `Delete 3 records`. Click it; the
  three rows are removed. ⌘Z restores them.
- Same setup; right-click a row outside the selection. Assert the
  selection is cleared (checkboxes go neutral) and the full menu
  shows against the right-clicked row.

## P6. Out of scope

- Making the rule-2 selection clear reversible via ⌘Z. D-5b
  explicitly accepts the irreversibility. Revisit only if user
  testing surfaces complaints.
- Adding a `rowBulkActions(selectedRowIds)` slot for consumer-
  defined multi-row actions. Not needed today; PRD §9 leaves it as
  a future extension.

## P7. Risks

- **Re-entrant `rowSelection.clear()` race.** Calling `clear()`
  inside the `contextmenu` handler and then opening the menu in
  the same tick could land an out-of-order render where the menu
  sees the pre-clear selection state. Mitigation: do not read
  `rowSelection` after `clear()`; pass the post-clear values
  (`{ selectionCount: 0, rowIsInSelection: false }`) directly into
  the opener. The snapshot is the source of truth; subsequent
  `rowSelection` state never re-enters the menu.
- **`aria-label` change between branches.** Screen readers should
  announce the right context. Mitigation: derive the label from
  the frozen snapshot, not from the current `rowSelection`.
