---
DATE: 2026-06-04
TIME: 17:30
STATUS: Done — landed 2026-06-04 on main
AUTHOR: Ed May / Claude
SCOPE: `rowActions` extension slot on `DataTableProps`. Lets each
       consumer inject its own row-menu items without forking the
       menu. One fixture consumer in the unit suite; no production
       consumer wiring lands here.
RELATED:
  - planning/features/row-context-menu/PRD.md §9, §10.1
  - planning/features/row-context-menu/decisions.md D-3
  - frontend/src/shared/ui/data-table/types.ts (DataTableProps,
    bulkSelectionActions precedent)
  - frontend/src/shared/ui/data-table/components/RowContextMenu.tsx
  - frontend/src/shared/ui/data-table/__tests__/bulkSelectionActions.test.tsx
---

# Phase 4 — `rowActions` extension slot

## P0. Why this slice

Phase 4 lands the consumer extension contract so each DataTable
consumer can ship its own row-menu items. The library does not own
every row action across the product (Materials' "Submit to Phius
library", Rooms' future "Apply assembly preset", etc). The slot
mirrors the existing `bulkSelectionActions` render-prop pattern.

The phase is intentionally library-only. No production consumer
wires `rowActions` in this phase — consumers adopt the slot as
their own actions ship. The DataTable unit suite gets a fixture
consumer to lock the contract.

## P1. Acceptance — Phase 4 done when

1. `DataTableProps<TRow>` gains an optional
   `rowActions?: (ctx: RowActionContext<TRow>) => RowAction[]`
   prop with full JSDoc explaining (a) when the selector is
   invoked (at menu open, with the right-clicked row's context),
   (b) the consumer's responsibility to memoize if needed, (c)
   undo semantics (opt-in via `controller.onWrite`), and (d)
   suppression in the multi-select-collapse branch.
2. The `RowAction` and `RowActionContext<TRow>` types are exported
   from `data-table/index.ts`.
3. When the consumer provides `rowActions`, the row menu renders
   the returned items after the four built-ins, separated by a
   single divider (`data-table-column-menu-separator` — add the
   class if not already present).
4. When the consumer's `rowActions` returns `[]`, no divider
   renders.
5. In the multi-row-collapse branch (PRD §5 rule 1), custom
   actions are **suppressed** — the menu still shows only
   `Delete N records`.
6. A `RowAction.danger === true` item routes to `data-danger="true"`
   styling, identical to the built-in `Delete record`.
7. A `RowAction.icon` ReactNode renders in the left 16-px icon
   slot via the same `--with-icon` modifier.
8. A `RowAction.shortcutHint` renders as right-aligned muted
   text, **but the library does not register a global keyboard
   shortcut for it** (PRD §2 non-goal).
9. Calling a custom action's `onSelect` closes the menu first,
   then invokes the closure (same lifecycle as built-in items).
10. `make ci` is green; new Vitest cases cover items 3–9 against a
    fixture consumer; a Playwright e2e drives a fixture page that
    exposes a `rowActions` selector.

## P2. Files

### Modified

- `frontend/src/shared/ui/data-table/types.ts`:
  - Add `RowAction`, `RowActionContext<TRow>`.
  - Add `rowActions?: (ctx: RowActionContext<TRow>) => RowAction[]`
    to `DataTableProps<TRow>`.
- `frontend/src/shared/ui/data-table/index.ts` — re-export
  `RowAction` and `RowActionContext`.
- `frontend/src/shared/ui/data-table/DataTable.tsx`:
  - On `contextmenu`, when in the single-row branch (not
    collapsed), invoke
    `rowActions?.({ rowId, row, selectionCount, rowIsInSelection })`
    and pass the result to the menu.
- `frontend/src/shared/ui/data-table/components/RowContextMenu.tsx`:
  - Accept `customActions: RowAction[]`.
  - In the non-collapsed branch, render the divider + custom
    items after the four built-ins.
  - Wire `useGridMenuKeyboard({ itemCount: builtIns + custom })`
    so arrow-key navigation flows through both ranges.
- `frontend/src/shared/ui/data-table/__tests__/RowContextMenu.test.tsx`
  — fixture-consumer cases.
- `frontend/tests/e2e/row-context-menu-row-actions.spec.ts` — a
  fixture page (one of the existing test-only pages, or a new
  one) that exposes a `rowActions` selector returning two items.

## P3. Types

In `types.ts`:

```ts
import type { ReactNode } from "react";

/**
 * One consumer-defined item rendered after the built-ins in the row
 * context menu. The library does not interpret `onSelect`; the
 * consumer's closure decides:
 *   - Dispatch via `controller.onWrite(op)` to ride the existing undo
 *     pipeline. Requires the consumer to record a matching inverse
 *     op so ⌘Z works.
 *   - Call a consumer API directly (no library-managed undo).
 *
 * `shortcutHint` is display-only — the library does not register a
 * global keyboard shortcut for it. Decision D-3 / PRD §2 non-goal.
 */
export type RowAction = {
  /** Stable id used for React keys, test selectors, telemetry. */
  key: string;
  label: string;
  /** Optional lucide-react icon. Renders in the left 16-px slot. */
  icon?: ReactNode;
  /** Right-aligned muted hint text. Display-only. */
  shortcutHint?: string;
  /** Routes to `data-danger="true"` for the red tint. */
  danger?: boolean;
  /** Called after the menu closes. */
  onSelect: () => void;
};

export type RowActionContext<TRow> = {
  rowId: string;
  row: TRow;
  /**
   * Snapshot of `rowSelection.count` at right-click time (frozen for
   * the menu's lifetime per PRD §5).
   */
  selectionCount: number;
  rowIsInSelection: boolean;
};
```

On `DataTableProps<TRow>`:

```ts
/**
 * Consumer-supplied row-menu items. Invoked at menu-open time with
 * the right-clicked row's context. Suppressed during the multi-
 * select-collapse branch (PRD §5 rule 1). Returns `[]` to render
 * no extra items.
 *
 * Memoization: the library calls the selector each time the menu
 * opens. If the returned items' identity matters (e.g. for `key`
 * stability across menu re-opens), memoize at the consumer.
 */
rowActions?: (ctx: RowActionContext<TRow>) => RowAction[];
```

## P4. Render path

`RowContextMenu.tsx` flow in the non-collapsed branch:

```tsx
const allItems: RenderedItem[] = [
  { kind: "builtin", key: "insert", label: "Insert record", icon: <ArrowDown />, shortcutHint: "⇧ ⏎", onSelect: onInsertBelow },
  { kind: "builtin", key: "duplicate", label: "Duplicate record", icon: <Copy />, onSelect: onDuplicate },
  ...(onOpen ? [{ kind: "builtin", key: "open", label: "Expand record", icon: <Maximize2 />, onSelect: onOpen }] : []),
  { kind: "builtin", key: "delete", label: "Delete record", icon: <Trash2 />, shortcutHint: "⌫", danger: true, onSelect: onDelete },
  ...(customActions.length > 0
    ? [{ kind: "separator" as const }, ...customActions.map((a) => ({ kind: "custom" as const, ...a }))]
    : []),
];
```

Keyboard nav: `useGridMenuKeyboard({ itemCount: allItems.filter((i) => i.kind !== "separator").length })`. Separators are skipped in
the `itemRefs` array.

## P5. Sequence

1. Land types + index re-export.
2. Wire `rowActions` invocation in `DataTable.tsx`.
3. Render path in `RowContextMenu.tsx`.
4. Vitest cases against a fixture consumer.
5. e2e against a fixture page.

## P6. Tests

### Vitest — fixture consumer

```ts
const fixtureRowActions = (ctx: RowActionContext<{ id: string; name: string }>) => [
  { key: "ping", label: "Ping row", icon: <Bell />, onSelect: () => onPing(ctx.rowId) },
  { key: "archive", label: "Archive row", danger: true, onSelect: () => onArchive(ctx.rowId) },
];
```

Cases:

- Renders the two fixture items after the four built-ins with one
  divider.
- `data-danger="true"` on the Archive item.
- `Bell` icon renders in the icon slot of Ping.
- Returning `[]` produces no divider.
- Multi-row-collapse branch hides both fixture items.
- Arrow-key navigation flows through the built-ins and into the
  custom items in document order.
- Clicking Ping closes the menu first, then calls `onPing` with
  the right row id.
- Selector is called with the right `RowActionContext`
  (`selectionCount`, `rowIsInSelection` reflect the snapshot from
  the right-click).

### Playwright e2e — `row-context-menu-row-actions.spec.ts`

- Mount a fixture page (or the existing DataTable smoke page) that
  exposes the same two fixture items via `rowActions`.
- Right-click a row, click Ping, assert the page-level state shows
  the ping happened.
- Right-click a row in a 2+-row selection, assert the fixture items
  do **not** render (rule 1 suppression).

## P7. Out of scope

- Consumer production wiring. Each consumer adopts `rowActions` when
  they ship their own actions; not driven by this phase. Likely
  candidates as they come up:
  - Materials: `Submit to Phius library`, `Reactivate` (for soft-
    deleted rows), `Copy to clipboard`.
  - Rooms: `Apply assembly preset`, `Open in 3D viewer`.
  - Pumps: `Test against ASHRAE 90.1`.
- A parallel `rowBulkActions(selectedRowIds)` slot for the multi-
  select-collapse branch. Not needed by any consumer today; add
  when one does. The shape is obvious from the precedent here.
- Consumer-registrable global keyboard shortcuts. Hard non-goal
  per PRD §2; the slot exposes display-only `shortcutHint` text.

## P8. Risks

- **Consumer's selector closure stability.** If the consumer
  passes an inline arrow function, the selector identity changes
  every render but that's fine — the library only calls it at
  menu-open. Document the no-memoization-needed common case in
  the JSDoc.
- **Test selector by `data-row-action-key`.** Add a stable
  `data-row-action-key={item.key}` attribute on each rendered
  custom item so e2e tests don't depend on label text. Built-ins
  get `data-row-action-key="insert"` etc. for symmetry.
- **Custom items as the menu's last items vs. AirTable's grouped
  ordering.** AirTable groups by category with separators. We
  emit one divider before the consumer block; if a consumer ships
  many items in categories, they can render their own visual
  grouping via `label` text (no nested-menu support v1). Out of
  scope if it ever matters.
