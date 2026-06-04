---
DATE: 2026-06-04
TIME: 14:30
STATUS: Active — revised after architectural review
AUTHOR: Ed May / Claude
SCOPE: DataTable row context menu — behavior + extension contract
RELATED:
  - context/technical-requirements/data-table.md §Component Shape, §Row chrome
  - planning/features/row-context-menu/README.md
  - planning/features/row-context-menu/STATUS.md
  - planning/features/row-context-menu/decisions.md
  - planning/features/row-context-menu/phases/
  - frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx
  - frontend/src/shared/ui/data-table/components/GridGutter.tsx
  - frontend/src/shared/ui/data-table/DataTable.tsx (insertRowBelowActive, deleteSelectedRows, isPointerInActiveEditor)
  - frontend/src/shared/ui/data-table/types.ts (WriteOp)
  - frontend/src/features/catalogs/materials/controller.ts
  - frontend/src/features/equipment/lib.ts (roomsPayloadFromRowInsert / pumpsPayloadFromRowInsert)
  - backend/features/catalogs/materials/routes.py, service.py
  - backend/features/catalogs/_shared.py
  - backend/features/project_document/routes.py (slice-replace write model)
---

# Row Context Menu — PRD

## 1. Goal

Bring DataTable row operations to feature parity with AirTable's right-
click row menu (subset). Users right-click any row in any editable
DataTable surface and reach the four row-level operations the product
cares about — **Insert · Duplicate · Expand · Delete** — without going
to the gutter, keyboard shortcuts, or a separate toolbar.

The feature is also the moment we introduce a small, library-level
**row-action extension contract** so consumers can add their own menu
items (e.g. Materials "Submit to Phius library") on the same surface
without forking the menu component.

Reference image: AirTable's row menu lists Ask Omni / Insert / Duplicate
/ Apply template / Expand / Add comment / Copy cell URL / Send / Delete
— we ship the bolded subset plus a consumer-extension slot.

## 2. Non-goals

- AirTable's `Ask Omni`, `Apply template`, `Add comment`,
  `Copy cell URL`, `Send …` items as library-owned features. Consumers
  can ship them as their own `rowActions` (§9).
- Header-cell or single-cell context menus (header menu already exists;
  cell menus are a separate plan).
- Touch / long-press handling. Desktop right-click + keyboard only.
- Re-implementing row-insert / row-delete semantics: the menu is a UI
  surface over the existing `WriteOp` paths.
- Consumer-registrable global keyboard shortcuts for `rowActions`
  (would collide with the grid's existing keyboard model). The slot
  exposes a display-only `shortcutHint` field.

## 3. Architecture overview

Three architectural decisions drive every other section of this PRD.
They were reached after a review of the V1 PRD against the current
codebase; see `decisions.md` for the full log.

### 3.1 Two consumer write models — handled by `onWrite` switch, not by uniform endpoints

DataTable consumers fall into two camps that write very differently:

| Consumer write model | Examples | Mutation path |
|---|---|---|
| **CRUD per-row REST** | Materials, glazing_types, frame_types | `PATCH /catalogs/{resource}/{id}`, `DELETE`, `POST` of new rows. Backend owns id generation, audit, validation. |
| **Slice-replace versioned document** | Rooms, ERV / Pumps / Fans (under `project_document`) | `PUT /api/v1/projects/{id}/draft/tables/{table_name}` — the whole table slice is rewritten in one call; audit and schema-mutation pipelines run there. There are no per-row endpoints. |

Every consumer already routes its writes through its own `onWrite`
callback. The library does **not** assume CRUD endpoints exist on every
resource — it emits a uniform `WriteOp` and each consumer translates
that into its own mutation path. Duplicate follows the same pattern: a
CRUD consumer calls `POST /{id}/duplicate`; a slice-replace consumer
clones the source `TRow` client-side and dispatches its existing slice-
replace write.

The earlier draft's "every backend object gets its own duplicate
endpoint" rule is rejected (decision D-1). It only fits CRUD consumers
and would force a redundant per-row endpoint family onto the
project_document slice-replace model.

### 3.2 `WriteOp.rowDuplicate` carries enough for both paths

The new `WriteOp` variant carries `sourceRowId`, a full `sourceRow`
snapshot captured at op-emit time, the library-assigned tmp `rowId`,
and the `anchorRowId`. The snapshot serves both write models:

- **CRUD consumers** use `sourceRowId` to call the duplicate endpoint;
  the snapshot is unused on the forward path but feeds the inverse
  `rowDelete` for ⌘Z.
- **Slice-replace consumers** use the snapshot directly to construct
  the new slice payload — there is no per-row endpoint to hit.

This is decision D-2. The earlier draft's "id-only" payload was
insufficient for slice-replace consumers; passing the snapshot makes
the library-to-consumer contract uniform without forcing CRUD-shaped
backends onto every resource.

### 3.3 Consumer-extensible `rowActions` slot

The library ships the four built-in items but **does not** own every
row-level action across the product. A `rowActions?: (ctx) =>
RowAction[]` render-prop slot on `DataTableProps` lets each consumer
inject its own menu items on the same surface. Action `onSelect`
closures can either dispatch a `WriteOp` (riding the existing undo
pipeline) or call a consumer API directly (no undo) — the consumer
chooses per-action.

This is decision D-3. The pattern mirrors the existing
`bulkSelectionActions`, `overflowMenuActions`, and `footerAction`
render-prop slots already in `DataTableProps`.

## 4. Built-in menu items

Icons come from `lucide-react`. Order matches AirTable's familiar
ordering minus the items we don't ship.

| Item              | Icon       | Shortcut hint | Effect |
|-------------------|------------|---------------|--------|
| Insert record     | `ArrowDown`| `⇧ ⏎`        | Insert a blank record below the right-clicked row. Same path as `insertRowBelowActive` in `DataTable.tsx` — `WriteOp` kind `rowInsert`, `anchorRowId` = right-clicked row's id, inverse `rowDelete`. After insert, focus is placed in the first editable cell (existing pending-edit handoff). |
| Duplicate record  | `Copy`     | —            | Insert a copy of the right-clicked row immediately below it. New `WriteOp` kind `rowDuplicate` (§6). Inverse is `rowDelete` of the new row. |
| Expand record     | `Maximize2`| —            | Open the per-row attribute modal — same callback the gutter expand icon already invokes (`onRowOpen`). Hidden when the consumer does not pass `onRowOpen`. |
| Delete record     | `Trash2`   | `⌫`          | Delete the right-clicked row. `WriteOp` kind `rowDelete`, inverse `rowInsert` reconstructed from the current `TRow`. Rendered with `data-danger="true"`. |

When `readOnly` is true, OR `onWrite` is not wired, OR the table is in
viewer mode, the row menu does not open — the browser's native context
menu shows instead. This matches `HeaderContextMenu`'s viewer fallback
and avoids rendering disabled menu items per
`context/technical-requirements/data-table.md`.

**Naming.** The user-facing label is `Expand record` (matches AirTable;
matches the gutter button's `aria-label="Expand row N"`). The internal
prop on RowContextMenu is `onOpen?` to match the library's existing
`onRowOpen` prop on `DataTableProps`. Decision D-4.

## 5. Multi-select behavior

The checkbox-driven row-selection set (`useGridRowSelection`) is
already plumbed and exposed as `rowSelection` inside `DataTable.tsx`.

Governing principle (decision D-5): **the right-click sets the target.**
Whichever row(s) the menu acts on are determined at right-click time,
not by the prior selection state.

Rules:

1. If `rowSelection.count >= 2` AND the right-clicked row id is in the
   selection: the menu **collapses to a single item** —
   `Delete N records` — and clicking it invokes the existing
   `deleteSelectedRows` callback. Insert / Duplicate / Expand are
   hidden. `rowActions` are also suppressed in this branch (Option A
   per the architectural review).
2. If `rowSelection.count >= 2` AND the right-clicked row id is **not**
   in the selection: clear the checkbox selection, treat as a normal
   single-row gesture, show the full four-item menu (plus
   `rowActions`) against the right-clicked row.
3. If `rowSelection.count <= 1`: show the full four-item menu (plus
   `rowActions`) against the right-clicked row. Any existing single-
   row checkbox state is left alone.

Rule 1 is the only branch that calls `deleteSelectedRows`; all other
branches operate on a single row id derived from the right-click
target, not from the selection set.

**Known side effect (D-5b).** Rule 2 clears the checkbox selection on
right-click. `rowSelection` is not part of `useGridHistory`, so this
clear is **not** reversible with ⌘Z. We accept this as the simplest
predictable behavior; a future enhancement could defer the clear until
the user confirms a menu item rather than at menu-open time. Documented
explicitly here so users / future code-readers aren't surprised.

**Render-perf contract.** The values `selectionCount` and
`rowIsInSelection` are read at right-click time and **frozen** for the
menu's lifetime (captured into the menu's `open` state). The menu does
not re-read `rowSelection` on every toggle. This avoids re-renders of
the closed menu on bulk selection changes.

## 6. WriteOp extension — `rowDuplicate`

Per decision D-3 / D-6, every row-bearing DataTable consumer supports
Duplicate. The library treats Duplicate as a first-class row op and
does not gate it behind a per-consumer capability flag.

Add a new variant to `WriteOp` in
`frontend/src/shared/ui/data-table/types.ts`:

```ts
export type RowDuplicatePayload = {
  // Tmp id assigned by the library for the new row; same lifecycle as
  // `rowInsert.rowId` — survives until the backend returns the
  // canonical id on invalidate (CRUD) or until the slice-replace PUT
  // round-trips (slice-replace).
  rowId: string;
  // The existing row to duplicate. The library does not interpret the
  // source's field values; the consumer's `onWrite` decides whether to
  // call a backend duplicate endpoint by id or clone the snapshot
  // client-side.
  sourceRowId: string;
  // Full source TRow snapshot at op-emit time. Carried as `unknown` to
  // match `RowDeletePayload.row`'s style; the consumer's `onWrite`
  // knows the concrete TRow shape and casts at its boundary. The
  // snapshot is also used as the inverse `rowDelete.row` for ⌘Z.
  sourceRow: unknown;
  // The row id immediately above the new row at insert time — almost
  // always equal to `sourceRowId`, but kept separate so future
  // "duplicate to top / bottom" gestures are expressible without a
  // WriteOp shape change.
  anchorRowId: string | null;
};

export type WriteOp =
  | …existing variants…
  | { kind: "rowDuplicate"; rows: RowDuplicatePayload[] };
```

**Inverse for ⌘Z.** `{ kind: "rowDelete", rows: [{ rowId: <new tmp id>,
row: <sourceRow snapshot>, anchorRowId }] }`. The snapshot is the same
object captured on the forward op; the library does not reconstruct
it.

**Undo across an invalidate cycle (Materials).** Materials' `onWrite`
returns the duplicate via `POST /materials/{sourceRowId}/duplicate`
and then invalidates the list query; the backend-assigned id replaces
the tmp `rowId`. ⌘Z then dispatches `rowDelete` with the tmp `rowId`,
which the controller cannot map to a real id. This is the same
pre-existing limitation already present for `rowInsert`-then-⌘Z on
Materials and is **out of scope** for this feature. Documented in §13
as a risk; fix lives in the controller's tmp-id ↔ real-id reconciler,
not in the menu.

**Slice-replace consumers** (Rooms, Pumps, future ERV/Fan) use the tmp
`rowId` as the persisted id directly; ⌘Z round-trips cleanly.

### Why a dedicated kind, not a `rowInsert` with the source row attached?

- `rowInsert` semantically means "blank row with field defaults" — its
  payload carries `fieldDefaults: Record<string, unknown>`, not a full
  `TRow`. Duplicate is a different gesture and warrants a distinct
  case in every consumer's `onWrite` switch.
- A CRUD consumer's `POST /{id}/duplicate` may preserve fields the
  grid does not see (audit columns, attachments, computed identity
  suffixes like `(copy)`), which `fieldDefaults` cannot reach. Modeling
  this through `rowInsert` would force a misleading payload shape.
- Per-resource id-generation and suffix rules live behind each backend
  endpoint; the WriteOp's job is to identify the gesture, not to
  carry per-resource resolution logic.

## 7. Backend — Materials duplicate endpoint (CRUD-only)

Slice-replace consumers do **not** get backend duplicate endpoints
(decision D-1). They clone client-side and ride the existing
`PUT /draft/tables/{table_name}` write. See §8.

### 7.1 Endpoint

```
POST  /api/v1/catalogs/materials/{material_id}/duplicate
        Body: (none)
        201 → CatalogMaterialPublic   # the newly created record
        404 if {material_id} not found / soft-deleted
        403 if the auth principal lacks write
```

### 7.2 Service-layer responsibilities (`backend/features/catalogs/materials/service.py`)

1. Load the source record via `repository.get_material`. 404 on miss.
2. Build a new record with all fields copied, except:
   - new internal id from `new_catalog_record_id()`;
   - `name` suffixed with ` (copy)` resolved via the
     `next_copy_suffix()` helper (§7.3);
   - fresh `created_by` / `updated_by` / timestamps from the
     repository's create path.
3. Insert through `repository.insert_material` so listing /
   import-export / validation stay consistent.
4. Log a new `catalog_record_create` action via `log_catalog_action`
   (no separate `catalog_record_duplicate` action kind for v1 — the
   audit row identifies it as a create, which is what it is from the
   table's perspective).
5. Return the full `CatalogMaterialPublic` payload.

### 7.3 `(copy)` suffix helper

Add to `backend/features/catalogs/_shared.py`:

```python
def next_copy_suffix(
    base_name: str,
    sibling_names: Iterable[str],
) -> str:
    """Resolve the next free " (copy)" / " (copy 2)" / … name.

    Matches AirTable's duplicate behavior. The caller passes the set of
    existing sibling names within the same scope; this helper returns
    the first free name in the `<base> (copy[ N])` series.
    """
    …
```

Each catalog's repository gets a thin sibling-name probe (a `LIKE`
query over the active rows). The helper is pure / unit-testable.

**Concurrency** is uneven across consumers and is called out
explicitly:

- **Materials** is firm-global; two users could resolve to the same
  ` (copy)` concurrently. Accepted for now (no users, no deploys).
  Future fix: unique constraint on `(name)` plus a 409-retry loop in
  the service layer. Tracked in §13.
- **Slice-replace consumers** (Rooms / Pumps) are single-writer per
  draft (the `project_document` draft model already serializes writes
  per project), so concurrency is not a risk from this feature.

### 7.4 Resources in scope for backend work

- `POST /api/v1/catalogs/materials/{material_id}/duplicate` (Phase 3a).

Glazing-types / frame-types follow the same pattern when they need
Duplicate UI; the helper in `_shared.py` is already factored to serve
them. No work for those resources in this feature.

## 8. Frontend — slice-replace consumers

Slice-replace consumers add a `*payloadFromRowDuplicate` helper next
to the existing `*payloadFromRowInsert` / `*payloadFromRowDelete`
helpers in `frontend/src/features/equipment/lib.ts`. Sketch
(Rooms; Pumps follows the same shape):

```ts
export function roomsPayloadFromRowDuplicate(
  current: RoomsSlice,
  duplicates: RowDuplicatePayload[],
): RoomsReplacePayload {
  const rooms = [...current.rooms];
  for (const dup of duplicates) {
    const source = dup.sourceRow as RoomRow;
    const clone: RoomRow = {
      ...source,
      id: dup.rowId,
      name: nextCopySuffix(source.name, rooms.map((r) => r.name)),
    };
    const anchorIndex = dup.anchorRowId
      ? rooms.findIndex((r) => r.id === dup.anchorRowId)
      : -1;
    const insertAt = anchorIndex === -1 ? rooms.length : anchorIndex + 1;
    rooms.splice(insertAt, 0, normalizeRoomForPayload(clone, current.field_defs));
  }
  return {
    rooms,
    single_select_options: cloneOptions(current),
    field_defs: [...current.field_defs],
  };
}
```

The `nextCopySuffix` TS helper lives in
`frontend/src/features/equipment/lib.ts` (or a shared util if a third
consumer needs it). Identical behavior to the backend helper.

The consumer's `onWrite` switch adds a `case "rowDuplicate"` that
calls the new helper and dispatches the existing slice-replace
mutation.

## 9. Extension slot — `rowActions`

Library shape (lands in `types.ts`):

```ts
export type RowAction = {
  // Stable id used for React keys, test selectors, telemetry.
  key: string;
  label: string;
  // Optional lucide-react icon node. Library renders it in the left
  // 16-px icon slot via the --with-icon menu-item modifier.
  icon?: ReactNode;
  // Right-aligned muted label text. Display-only — see §2 non-goal on
  // consumer-registrable shortcuts.
  shortcutHint?: string;
  // Routes to `data-danger="true"` for the red tint.
  danger?: boolean;
  onSelect: () => void;
};

export type RowActionContext<TRow> = {
  rowId: string;
  row: TRow;
  selectionCount: number;
  rowIsInSelection: boolean;
};
```

`DataTableProps<TRow>` gets a new optional prop:

```ts
rowActions?: (ctx: RowActionContext<TRow>) => RowAction[];
```

Rendering rules:

- Consumer actions render **after** the four built-ins, separated by a
  single divider.
- The selector is called with the right-clicked row's context. To
  avoid stale closures, the function is read on each menu open; the
  consumer is responsible for memoizing if the returned items'
  identity matters.
- Suppressed during the multi-select-collapse branch (rule 1) — see
  §5. A future `rowBulkActions(selectedRowIds)` slot can land when a
  consumer needs custom multi-row actions; out of scope for v1.
- The library does not call `onSelect` with any arguments. The
  consumer's closure already knows the row from the selector context.
- `onSelect` may dispatch a `WriteOp` via `controller.onWrite(…)` to
  ride undo, OR call its own API directly (no undo). The library does
  not enforce either path. Documented in the consumer-facing JSDoc.

This slot ships in Phase 4 (after the four built-ins are stable). No
consumer wiring is required in Phase 1 – 3.

## 10. Component contract

### 10.1 New file — `RowContextMenu.tsx`

`frontend/src/shared/ui/data-table/components/RowContextMenu.tsx`,
mirrors `HeaderContextMenu.tsx`:

- Radix Popover anchored at the pointer via `pointAnchorRef`.
- Arrow-key / Home / End focus management via the new shared hook
  `useGridMenuKeyboard` (§10.4).
- `onCloseAutoFocus` restores focus to the originating `<tr>` (or the
  `data-table-gutter-number` button when keyboard-opened).
- `data-danger="true"` on `Delete record` for the existing red style.

Props:

```ts
export type RowContextMenuProps<TRow> = {
  rowId: string;
  rowNumber: number;             // 1-based, for aria-label
  // Frozen at right-click time (§5 render-perf contract).
  selectionCount: number;
  rowIsInSelection: boolean;
  // Callbacks the table wires from its existing row-op handlers.
  onInsertBelow: () => void;
  onDuplicate: () => void;       // always present (decision D-3)
  onOpen?: () => void;           // omitted when DataTable has no onRowOpen
  onDelete: () => void;
  onDeleteSelection: () => void; // used only in the collapsed branch (rule 1)
  // Consumer-supplied items (§9). Always called by the menu (not by
  // DataTable.tsx) so the menu controls when it runs.
  customActions: RowAction[];
  // Anchor + focus-restore target for keyboard-opened menus.
  triggerRef: RefObject<HTMLElement | null>;
  isViewer: boolean;
};
```

### 10.2 `DataTable.tsx` wiring

- Refactor `insertRowBelowActive` → `insertRowBelow(anchorRowId)`,
  same body but with an explicit anchor. The Shift+Enter shortcut
  calls it with the current active row's id; the menu calls it with
  the right-clicked row's id.
- Reuse `deleteSelectedRows` for the multi-select collapse branch.
- Add `deleteRowById(rowId)` — same body as `deleteSelectedRows` but
  scoped to a single id. The single-row branch wires `onDelete` to
  it.
- Add `duplicateRowById(rowId)` — emits `rowDuplicate` with
  `sourceRowId = rowId`, `sourceRow = visibleDataRows[…]`, and
  `anchorRowId = rowId`. Inverse is `rowDelete` with `row: sourceRow`.
- Duplicate is **always** wired when `onWrite` is present and
  `readOnly` is false — no consumer capability flag.
- Expose `onRowOpen` to the row menu via the same prop the gutter
  already consumes. No new DataTable prop.
- The `rowActions` selector (if provided) is invoked at menu-open
  time with `{ rowId, row, selectionCount, rowIsInSelection }`.

### 10.3 Trigger surface — `GridBody.tsx`

- Listen for `contextmenu` on the `<tbody>` (single delegated
  listener). Identify the target row from the `data-row-id` attribute
  already on each `<td>` (or hoisted to the `<tr>`).
- **Use the existing `isPointerInActiveEditor` predicate from
  `DataTable.tsx` to suppress the menu when the event target is
  inside any active editor** (text editor, color editor,
  single-select popover, fill handle). Phase 1 hoists this predicate
  into `frontend/src/shared/ui/data-table/lib/eventTargets.ts` so the
  contextmenu hit-test and the pointer-drag short-circuit share one
  list. Decision D-7.
- Suppress when the event target is the gutter checkbox — leave the
  browser's native menu so users can debug DOM (matches current
  behavior).
- Keyboard: `Shift+F10` / `ContextMenu` key on the focused row's
  gutter button opens at the row's bottom-left. Reuse the keyboard
  pattern from `HeaderContextMenu` via the shared hook (§10.4).

### 10.4 Shared menu keyboard hook

Extract from `HeaderContextMenu.tsx` (today's hand-rolled focus
manager) into
`frontend/src/shared/ui/data-table/hooks/useGridMenuKeyboard.ts`:

```ts
export function useGridMenuKeyboard(args: {
  itemCount: number;
  initialIndex?: number;
}): {
  activeIndex: number;
  setActiveIndex: (next: number) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  itemRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
};
```

Both `HeaderContextMenu` and the new `RowContextMenu` consume it.
This is decision D-8 — it prevents the two menus from drifting on
keyboard semantics (currently `HeaderContextMenu` has ~70 lines of
ad-hoc focus/keyboard code that the new menu would otherwise
duplicate).

We do **not** adopt `@radix-ui/react-context-menu`. The hand-rolled
approach + shared hook keeps the menu visual style identical to
`HeaderContextMenu`'s pop-over (per existing
`data-table-column-menu` styles) and avoids introducing another
@radix-ui/* package onto the pnpm minimum-release-age tracker.
Decision D-9.

## 11. Accessibility

- Menu root has `role="menu"` and `aria-label` of
  `Row {rowNumber} actions` (or `Selected rows actions` in the
  collapsed branch).
- Each item is a `<button role="menuitem">`. Arrow-key navigation +
  Home/End wraps inside the menu. Escape closes and restores focus
  to the originating element.
- Live-region announcements ride the existing `setAnnounce` channel:
  `"Row inserted"`, `"Row duplicated"`, `"Row deleted"`,
  `"{N} rows deleted"`. The first three are already announced today
  for the keyboard paths; this feature wires the announce calls into
  the new menu handlers.
- Right-click on a row does **not** change the active cell. Selection
  is unchanged in the single-row branches (rules 2 — by clear — and
  3) and is what triggers the collapsed branch (rule 1).

## 12. Visual design

Reuse `data-table-column-menu` and `data-table-column-menu-item`
classes already defined in `DataTable.css`. Add a left-aligned 16-px
icon slot to the item template:

```
[icon] [label] [optional keyboard hint]
```

The icon slot is added to the shared menu item class behind a
modifier — `data-table-column-menu-item--with-icon` — so the existing
header menu (text-only items today) keeps its current look until a
follow-up pass adds icons there too.

Keyboard hint (right-aligned, muted) for items that have shortcuts:

- `Insert record` → `⇧ ⏎`
- `Delete record` → `⌫`

`Duplicate` and `Expand` have no current shortcut. Consumer `rowActions`
may set `shortcutHint` for display purposes only.

## 13. Acceptance criteria

1. Right-clicking any data row in the materials catalog opens a menu
   with `Insert record`, `Duplicate record`, `Expand record`,
   `Delete record`. Each item has its lucide icon and works.
2. `Insert record` creates a blank row below the right-clicked row
   and focuses the first editable cell, matching Shift+Enter
   behavior.
3. `Duplicate record` creates a new row immediately below the source
   with the source's field values, and (for materials) a name
   suffixed with ` (copy)` resolved server-side. ⌘Z removes it
   within the same session (subject to the Materials tmp-id ↔
   real-id round-trip caveat in §6 / §14).
4. `Expand record` opens the existing per-row attribute modal —
   identical to clicking the gutter expand icon — when the consumer
   wires `onRowOpen`. The menu item is hidden otherwise.
5. `Delete record` deletes only the right-clicked row. ⌘Z restores
   it.
6. When 2+ rows are checkbox-selected and the user right-clicks one
   of them, the menu shows a single `Delete N records` item that
   deletes the full selection. ⌘Z restores the full set.
7. When 2+ rows are checkbox-selected and the user right-clicks a
   row that is **not** in the selection, the checkbox selection is
   cleared and the full menu opens against the right-clicked row.
   (Selection clear is not reversible; see §5.)
8. Viewer mode and `readOnly` surfaces fall through to the browser's
   native context menu.
9. Shift+F10 / ContextMenu key opens the menu on the active row,
   anchored at the row's bottom-left. Arrow keys / Home / End / Esc
   work; Esc restores focus to the row's gutter button.
10. Right-clicking inside an open `InlineCellEditor` / color editor /
    single-select popover / fill handle does **not** open the row
    menu — the browser's native edit menu still works. Covered by
    the shared `isPointerInActiveEditor` predicate.
11. The same right-click gesture works on Rooms and Pumps tables and
    duplicates through the slice-replace path (no backend endpoint
    required).
12. A consumer that passes a `rowActions` selector sees its items
    rendered after the built-ins (and suppressed during the multi-
    select-collapse branch). Tested via a fixture consumer in the
    DataTable unit suite.
13. `make ci` is green: ESLint, Prettier, Vitest (component +
    integration suites for `RowContextMenu`, the shared keyboard
    hook, and the `rowActions` slot), Playwright e2e for the gesture
    surfaces (§14) and the per-consumer Duplicate happy paths
    (Materials, Rooms), and a backend pytest for
    `POST /catalogs/materials/{id}/duplicate` covering happy path,
    404, and `name → name (copy)` / `name (copy) → name (copy 2)`
    suffix resolution.

## 14. Risks & open questions

- **Materials Duplicate + ⌘Z across an invalidate cycle (pre-
  existing).** The Materials controller throws away the library's
  tmp `rowId` when it calls `createMaterial`, so the recorded
  inverse `rowDelete` references a tmp id the backend never knew.
  Affects `rowInsert`-then-⌘Z today too. Out of scope for this
  feature; fix lives in the controller's id reconciler when one is
  needed (e.g. a Materials-side `Map<tmpRowId, realRowId>` updated
  on each invalidate). Slice-replace consumers are unaffected.
- **`(copy)` suffix concurrency on Materials.** Two users
  duplicating the same row at the same moment could both resolve to
  ` (copy)`. Acceptable for early dev (no users). Future fix:
  unique constraint on `(name)` + 409 retry loop.
- **Selection clear in rule 2 is irreversible (§5 D-5b).** A right-
  click outside an existing 2+-row selection silently tears down
  that selection. `rowSelection` is not in history. Documented;
  user-visible behavior.
- **Phase 3a is the keystone PR.** It changes the public WriteOp
  type, ships the library's `duplicateRowById`, adds the Materials
  backend endpoint, wires the materials controller, and ships a
  pytest + e2e. Mitigated by splitting Rooms (Phase 3b) and Pumps
  (Phase 3c) into separate PRs against the stable WriteOp contract.
- **`useGridMenuKeyboard` extraction touches `HeaderContextMenu`.**
  The shared hook lands as part of Phase 1 and rewires
  `HeaderContextMenu` to use it. Risk of header-menu regression;
  the existing `HeaderContextMenu.test.tsx` suite is the safety net,
  augmented with new cases for the hook itself.
- **ERVs and Fans aren't yet real tables in this repo.** Today
  `equipment/components/` ships `PumpsTable.tsx` and
  `RoomsTable.tsx` but the ERV / Fan slots are
  `PlaceholderEquipmentTable`. Phase 3c covers Pumps only; ERVs and
  Fans get the slice-replace helper added when their real tables
  land. The PRD does not commit to backend endpoints for them
  (consistent with decision D-1).

## 15. Decisions log

The decisions in this PRD are tracked in `decisions.md` (D-1 through
D-9). See that file for the full reasoning and the rejected
alternatives. Future decisions on this feature should land there
first and be folded back into this PRD on the same docs pass.
