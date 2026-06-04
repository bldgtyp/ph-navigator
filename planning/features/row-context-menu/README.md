---
DATE: 2026-06-04
TIME: 14:30
STATUS: Active — planning (post-review)
AUTHOR: Ed May / Claude
SCOPE: DataTable row-level right-click context menu + extension contract
RELATED:
  - context/technical-requirements/data-table.md
  - planning/features/row-context-menu/PRD.md
  - planning/features/row-context-menu/decisions.md
  - planning/features/row-context-menu/STATUS.md
  - planning/features/row-context-menu/phases/
  - frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx
  - frontend/src/shared/ui/data-table/components/GridGutter.tsx
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/types.ts
  - frontend/src/features/catalogs/materials/controller.ts
  - frontend/src/features/equipment/lib.ts
  - backend/features/catalogs/materials/routes.py
---

# Row Context Menu — Feature Router

Add an AirTable-style right-click context menu to DataTable rows so
the existing row-level operations (Insert / Duplicate / Expand /
Delete) are discoverable from the row itself, not just from keyboard
shortcuts or the gutter expand affordance. At the same time,
introduce a small library-level **row-action extension contract** so
each DataTable consumer can ship its own menu items without forking
the menu component.

This is a revised plan. The previous architectural draft assumed
CRUD-everywhere endpoints; that didn't survive contact with the
`project_document` slice-replace write model. See `decisions.md` for
the full decision log (D-1 through D-12).

## Read order

1. `PRD.md` — behavior + extension contract; the canonical doc.
2. `decisions.md` — accepted/rejected decisions and their reasoning.
3. `phases/phase-01-…` through `phases/phase-04-…` for the
   implementation sequence.
4. `STATUS.md` — current phase, next step, blockers.

## Scope at a glance

In scope:

- New `RowContextMenu` component under
  `frontend/src/shared/ui/data-table/components/`, built on the same
  Radix Popover primitives as `HeaderContextMenu.tsx`.
- A shared keyboard hook (`useGridMenuKeyboard`) extracted from
  `HeaderContextMenu.tsx` so the two menus don't drift on focus /
  Arrow / Home / End / Esc behavior.
- A shared `isPointerInActiveEditor` predicate hoisted to
  `data-table/lib/eventTargets.ts` so the contextmenu hit-test and
  the pointer-drag short-circuit share one editor-scope list.
- Wiring through `DataTable.tsx` so right-clicking a `<tr>` opens
  the menu at the pointer.
- A new `rowDuplicate` `WriteOp` kind in `types.ts` carrying a full
  source TRow snapshot — enough for both CRUD (Materials) and
  slice-replace (Rooms / Pumps) consumers.
- A backend `POST /api/v1/catalogs/materials/{id}/duplicate` endpoint
  for the CRUD-consumer path.
- Per-consumer client-side duplicate helpers for the slice-replace
  consumers — no backend endpoints.
- Multi-row aware behavior: when the right-clicked row is part of a
  2+-row checkbox selection, the menu collapses to a single
  `Delete N records` action that operates on the full selection.
- Keyboard parity: `Shift+F10` / `ContextMenu` key opens the menu on
  the active row.
- A `rowActions?: (ctx) => RowAction[]` extension slot on
  `DataTableProps` so each consumer can inject its own menu items
  with full control over dispatch (WriteOp for undo, or direct API
  call for no undo).

Out of scope (followups):

- AirTable's `Ask Omni`, `Apply template`, `Add comment`,
  `Copy cell URL`, `Send …` items as built-ins. Consumers can ship
  any of them via `rowActions` when needed.
- Cell- or column-level context menus (handled by `HeaderContextMenu`
  + future cell-menu work; a future cell menu may justify revisiting
  D-9 and moving everything to `@radix-ui/react-context-menu`).
- Backend duplicate endpoints for slice-replace resources
  (project_document tables — Rooms, ERV / Pumps / Fans). Decision
  D-1 routes those through client-side cloning + the existing
  slice-replace PUT.
- Consumer-registrable global keyboard shortcuts on `rowActions`.
  The slot exposes a `shortcutHint` display field only.

## Phase map

- **Phase 1 — RowContextMenu shell + Insert / Expand / Delete.**
  Ships the new component, the shared `useGridMenuKeyboard` hook
  (with `HeaderContextMenu` rewired to use it), the shared
  `isPointerInActiveEditor` predicate, the delegated `contextmenu`
  listener on `<tbody>`, viewer/editor fallthrough, Shift+F10
  keyboard parity, and the single-row Insert / Expand / Delete
  items wired to existing handlers. Icon + shortcut-hint styling
  via the `--with-icon` modifier. No WriteOp change. No new
  endpoints.
- **Phase 2 — Multi-row Delete collapse.** PRD §5 rules 1 / 2 / 3.
  Collapsed `Delete N records` branch reusing
  `deleteSelectedRows`. Selection-clear-on-right-click side effect
  (D-5b) is documented in the menu's announce text but not made
  reversible.
- **Phase 3a — `rowDuplicate` WriteOp + Materials.** Adds the
  `rowDuplicate` shape in `types.ts`, `duplicateRowById` in
  `DataTable.tsx`, the Materials backend endpoint, the
  `(copy)`-suffix helper in `_shared.py`, the materials controller
  wiring, pytest, and e2e. The keystone PR — every later phase
  consumes the shape it lands.
- **Phase 3b — Rooms slice-replace Duplicate.**
  `roomsPayloadFromRowDuplicate` + RoomsPage wiring + e2e. No
  backend work.
- **Phase 3c — Pumps slice-replace Duplicate.**
  `pumpsPayloadFromRowDuplicate` + EquipmentPage wiring + e2e.
  ERV and Fan tables remain `PlaceholderEquipmentTable` for now;
  they pick up the helper pattern when their real tables land.
- **Phase 4 — `rowActions` extension slot.** Ships the prop on
  `DataTableProps`, the `RowAction` / `RowActionContext<TRow>`
  types, the menu renderer, the multi-select-collapse suppression
  rule, and one consumer fixture in the DataTable unit suite. No
  consumer production wiring lands in this phase; product consumers
  adopt the slot as their actions ship.
