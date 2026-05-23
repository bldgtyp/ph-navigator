---
DATE: 2026-05-23
TIME: planning
STATUS: Implementation complete — all 6 steps landed, demo walked clean, 155 tests passing.
SCOPE: Phase 2 of the `<DataTable>` AirTable-parity plan. Row-level
       write gestures (Shift+Enter insert-below; gutter-checkbox
       multi-row select; toolbar Delete with AlertDialog confirm).
       Both gestures emit one semantic `WriteOp` so ⌘Z reverts the
       whole gesture as a single entry (PoC L6.2). Driven against
       Rooms (US-EQ-2). No other consumers touched.
PARENT-PLAN: docs/plans/2026-05-23/datatable-airtable-parity.md
RELATED:
  - context/technical-requirements/data-table.md (canonical contract)
  - context/user-stories/30-tables-equipment.md
    (US-Builder-Tables criterion 10 — delete confirm; criterion 7 — add row)
  - docs/plans/2026-05-23/phase-0-foundation-refactor.md
  - docs/plans/2026-05-23/phase-1-inline-edit-popover.md
  - research/poc-plans/poc-lessons-for-real-build.md (L2.2, L6.1, L6.2, L6.3)
---

# Phase 2 — Row insert / delete with semantic undo

## 1. Why this phase exists

After Phases 0–1, the only mutation paths through `<DataTable>` are
cell-level: inline edit (text / number / single_select) and paste.
Adding or removing rows still goes through the Rooms add/delete
modals in `EquipmentTab` — outside the grid, outside history. A user
who wants a new room must leave the table, open a modal, fill four
fields, save, and then begin editing inline. A user who wants to
remove three rows has to delete them one at a time via the per-row
modal trigger.

Phase 2 closes that gap:

1. `Shift+Enter` from a focused (or editing) cell inserts a blank
   row directly below the active row, moves focus to the new row's
   first editable cell, and enters edit mode — all in one gesture.
   The op is a single `rowInsert` history entry; ⌘Z removes the row
   and any subsequent cell edits made against it (single-entry per
   L6.2).
2. The row-gutter grows a checkbox lane (L2.2 — outside the TanStack
   column model). Click / Shift+Click / ⌘-Click toggle a multi-row
   selection set that lives independently of the cell range.
3. A "Delete N rows" action surfaces in the toolbar whenever the set
   is non-empty. Clicking opens an `AlertDialog`-style confirm
   (Cancel / Delete; no name retyping — matches US-Builder-Tables
   criterion 10). Confirming emits one `rowDelete` op containing all
   deleted rows' full data; ⌘Z restores them.
4. The library never touches the consumer's row schema. A new
   `buildEmptyRow` prop lets the consumer expand the library's
   `FieldDef.default` map into a fully-shaped TRow, so the
   library-generated `tmp_*` row id and the consumer's TRow stay in
   lock-step.

After Phase 2, every row-level write that AirTable offers (and that
matters for Rooms) runs through `<DataTable>`'s write reducer and
its single history channel.

## 2. Binding constraints

1. **Library-only, plus the one allowed consumer ripple.** All
   primitive changes land in `frontend/src/shared/ui/data-table/`.
   Consumer changes are restricted to:
   - `frontend/src/features/equipment/routes/EquipmentTab.tsx` —
     `handleTableWrite` widens to dispatch on `rowInsert` / `rowDelete`.
   - `frontend/src/features/equipment/components/RoomsTable.tsx` —
     adds `buildEmptyRow` prop + `FieldDef.default` slots.
   - `frontend/src/features/equipment/lib.ts` — gains
     `roomsPayloadFromRowInsert` and `roomsPayloadFromRowDelete`.
   `RoomModal`, `RoomOptionManager`, and the existing add/delete
   buttons in `EquipmentTab` stay (they remain valid alternative
   entry points and are not in scope here).
2. **One semantic op per gesture (L6.1, L6.2).** A Shift+Enter that
   commits a pending cell edit AND inserts a row is still one
   history entry (the cell-commit op closes first, then the row-
   insert is a separate op — two entries — but each is one gesture's
   worth). A multi-row delete of N rows is exactly one history
   entry.
3. **Row-selection state is decoupled from the cell range (L2.2).**
   The cell range continues to drive copy / paste / fill (Phase 3,
   Phase 7). The row-selection set drives only the toolbar Delete
   action. Clicking a body cell does NOT clear the row-selection
   set; clicking a checkbox does NOT collapse the cell range.
4. **In-memory undo, no compensating writes (L6.3).** ⌘Z of a
   rowInsert dispatches a `rowDelete` to `onWrite`; the consumer's
   draft-buffer commit handles it identically to a real delete. No
   backend rollback API is consulted. History clears on `rows`
   identity change (Phase 0 contract preserved).
5. **No new keyboard or selection behaviors beyond what is
   enumerated below.** Range drag, full-column select, fill handle,
   stacked filter/sort, group accordion all stay deferred.
6. **One new dependency: `@radix-ui/react-alert-dialog`.** Same
   24-hour `minimumReleaseAge` gate as Phase 1's Popover install.
   No shadcn CLI scaffold.
7. **Read-only stays read-only.** When `readOnly={true}` (locked
   version, Viewer mode), the gutter checkboxes are hidden, the
   toolbar Delete action is hidden, and Shift+Enter is a no-op.

## 3. Acceptance criteria

"Phase 2 demo passed" means all twelve are true on a real browser
walk against Rooms.

1. **Shift+Enter from a focused-not-editing cell** inserts a row
   directly below the active row. **The new row's values are copied
   from the row above** (the anchor). Focus moves to the new row's
   first editable cell and edit mode opens (intent: `replace`).
   Required-unique fields (Rooms: `number`) are auto-resolved to
   the next free value by the consumer; non-unique fields
   (`name`, `floor_level`, `building_zone`, `num_people`,
   `num_bedrooms`, `icfa_factor`) match the anchor exactly so the
   row is valid at insert time.
2. **Shift+Enter from an editing cell** commits the current edit
   first, then performs (1). If commit fails (validation), no row
   is inserted.
3. **Shift+Enter while `readOnly`** is a no-op (no insert, no
   announce noise). Same in Viewer mode.
4. **Gutter checkbox click** toggles the row in the row-selection
   set. **Shift+Click** extends from the row-selection anchor
   (the most-recently single-clicked row) to the clicked row,
   inclusive. **⌘/Ctrl+Click** toggles a single row without
   touching the rest of the set. The gutter row-number button
   (existing) continues to drive its current cell-range behavior
   (`selection.selectRow`); the two channels are independent.
5. **Toolbar shows "Delete N rows" button** only when the row-
   selection set is non-empty. The button is keyboard-focusable and
   has an aria-label `Delete N selected rows`.
6. **Delete button** opens an `AlertDialog` with title "Delete N
   rows?", body "This cannot be undone from a saved version. You can
   ⌘Z to restore within this session.", and buttons Cancel /
   Delete. Default focus is Cancel. Esc cancels.
7. **Confirming delete** emits one `WriteOp.kind = "rowDelete"` with
   `rows` populated from the current props for every selected row
   id. The row-selection set clears. An aria-live announce fires:
   "N rows deleted."
8. **⌘Z after rowInsert** removes the new row and clears any
   pending edit on it. **⌘Z after rowDelete** restores all deleted
   rows; for Rooms (sorted by `number`), they reappear in their
   original visible positions because the sort recovers them.
9. **⌘⇧Z** redoes either gesture exactly. Round-trip insert →
   undo → redo leaves the row in place with the same id.
10. **No regressions in Phase 0 / Phase 1.** All existing tests in
    `__tests__/` pass without modification. The Phase 1 single-select
    popover, type-to-edit, Tab-bubble all still work.
11. **Existing add-room and delete-room modal paths still work.**
    The toolbar "Add room" button and the per-row delete via
    `RoomModal` keep their behavior. They route through their own
    payload helpers and bypass the library's history (acceptable —
    they predate `<DataTable>`).
12. **`make typecheck && make lint && make test && make format` and
    `pnpm run build`** all clean. `pnpm run dev` walks the §10 demo
    end-to-end without console errors.

## 4. Target architecture

### 4.1 File layout (after)

```
frontend/src/shared/ui/data-table/
  DataTable.tsx              shell + composition (compose new hook +
                             toolbar slot; still ≤ ~270 LOC)
  components/
    GridHeader.tsx           UNCHANGED
    GridBody.tsx             UNCHANGED (gutter rendering moves into
                             GridGutter; body cells unaffected)
    GridGutter.tsx           extended — checkbox + row-number, drives
                             two independent channels
    GridToolbar.tsx          NEW — extracted from DataTable.tsx's
                             inline `<div class="data-table-toolbar">`;
                             gains the row-selection action slot
    InlineCellEditor.tsx     UNCHANGED
    SingleSelectPopover.tsx  UNCHANGED
    ConfirmRowDeleteDialog.tsx
                             NEW — wraps `@radix-ui/react-alert-dialog`
  hooks/
    useGridRowSelection.ts   NEW — Set<string> + anchor + click-mode
                             reducer (single/shift/cmd)
    useGridSelection.ts      UNCHANGED — cell range only
    useGridKeyboard.ts       extended — Shift+Enter branch dispatches
                             insert; ignores when readOnly
    useGridEdit.ts           UNCHANGED API; gains an internal
                             `pendingFocus` channel (see §4.4)
    useGridHistory.ts        UNCHANGED
    useGridWriteReducer.ts   UNCHANGED
    useGridClipboard.ts      UNCHANGED
  fields/                    UNCHANGED
  lib.ts                     gains `extractRowDefaults(row, fieldDefs,
                             columns)` — pulls the anchor row's
                             values via the column accessors, keyed
                             by fieldKey. `FieldDef.default` is the
                             fallback path (no-anchor case);
                             `naturalZero(field_type)` is the
                             fallback's fallback.
  types.ts                   `rowInsert` / `rowDelete` op shapes
                             tightened; DataTableProps gains
                             `buildEmptyRow?`
  index.ts                   re-exports unchanged
  __tests__/                 existing tests preserved; new tests added
```

### 4.2 Type changes

**`WriteOp.rowInsert` / `WriteOp.rowDelete`** tighten from
`rows: unknown[]` to a typed pair:

```ts
export type RowInsertPayload = {
  rowId: string;        // tmp_<ULID> generated by the library
  fieldDefaults: Record<string, unknown>;
                        // values keyed by fieldKey; the consumer's
                        // buildEmptyRow expands these into a TRow
  anchorRowId: string | null;
                        // the rowId immediately above the new row at
                        // insert time; null = inserted at the top of
                        // the current visible order
};

export type RowDeletePayload = {
  rowId: string;
  row: unknown;         // the full TRow at delete time (lossless for
                        // the inverse rowInsert)
  anchorRowId: string | null;
                        // the rowId immediately above this one at
                        // delete time; used by inverse to restore
                        // position when the consumer respects it
};

export type WriteOp =
  | …  // existing kinds unchanged
  | { kind: "rowInsert"; rows: RowInsertPayload[] }
  | { kind: "rowDelete"; rows: RowDeletePayload[] };
```

Backward compat: nothing else in the union touches this shape; the
existing `kind: "rowInsert"; rows: unknown[]` slot is only declared
in `types.ts` and never written today, so this is a tightening with
zero migration. The Phase 1 `cell` / `paste` shapes are unchanged.

**`DataTableProps`** gains:

```ts
buildEmptyRow?: (args: {
  rowId: string;
  fieldDefaults: Record<string, unknown>;
  anchorRow: TRow | null;  // present on Shift+Enter inserts; null for
                           // a future "insert at top" affordance
}) => TRow;
```

`onWrite` consumers that want row insert MUST pass this. Library
calls it once per `rowInsert` gesture to render the new row
optimistically and to build the op payload `row` data on delete
inverse. When omitted, Shift+Enter is a no-op and announces
"Row insert not enabled for this table." (Same shape as the
existing "Paste is not enabled" message.)

**`FieldDef.default`** is already in `types.ts` (added during
Phase 0 as a forward-compat slot). Phase 2 starts honoring it.

### 4.3 New hook: `useGridRowSelection`

```ts
export type RowSelectionMode = "single" | "shift" | "cmd";

export type GridRowSelection = {
  selectedRowIds: ReadonlySet<string>;
  count: number;
  anchorRowId: string | null;
  toggle: (rowId: string, mode: RowSelectionMode) => void;
  clear: () => void;
  isSelected: (rowId: string) => boolean;
};

export function useGridRowSelection(args: {
  rowIds: string[];  // visible-order, used for Shift-extend
}): GridRowSelection;
```

Semantics:

- `single` mode (plain click on checkbox): replaces the set with
  `{rowId}`, sets `anchorRowId = rowId`. (NOT a no-op when already
  selected — turning off requires `cmd`.)
- `shift` mode: if `anchorRowId == null`, falls through to `single`.
  Otherwise computes the contiguous block from anchor to rowId in
  the visible `rowIds` order and unions it into the set. Anchor
  unchanged.
- `cmd` mode: flips `rowId` in/out of the set. If the set becomes
  empty, `anchorRowId = null`; otherwise anchor unchanged.

History notes: this state is **not** part of the cell-selection
projection and does NOT route through the write reducer — it's
ephemeral UI state. The set clears when `rowIds` identity changes
(same hook design as `useGridHistory.clear` on row-identity change),
because a refetched row list may have invalidated the stable ids.

### 4.4 Hook contract changes

**`useGridKeyboard`** — one new dispatch arm:

```ts
function onShiftEnter(event: KeyboardEvent): void {
  // - readOnly → no-op (no announce).
  // - !canInsert (buildEmptyRow undefined) → announce + no-op.
  // - edit.editing → await commit; if false, abort.
  // - dispatch rowInsert anchored on selection.activeCell's rowId.
}
```

The hook gets two new args:

```ts
onRowInsertAt: (anchorRowId: string | null) => Promise<void>;
canInsertRow: boolean;  // buildEmptyRow !== undefined && !readOnly
```

The composition in `DataTable.tsx` owns the row synthesis (so the
hook stays DOM-only) — see §4.5.

**`useGridEdit`** — gains a one-shot pendingFocus channel so the
"insert-then-edit" gesture survives the React re-render between
dispatching the op and the new row landing in props:

```ts
type PendingEdit = {
  rowId: string;
  fieldKey: string;
};

// API addition:
edit.queuePendingEdit(pending: PendingEdit | null): void;
edit.consumePendingEdit(rowIdsByCurrentRender: string[]): void;
```

`DataTable.tsx` calls `consumePendingEdit` in a `useEffect` keyed on
`rowIds`. When the pending rowId appears in the current render, the
hook calls `start({intent: "replace", initialValue: <default>})`
and clears the pending entry. If the row hasn't appeared after one
microtask flush, the pending entry is dropped silently (the consumer
either rejected the insert or remapped the id).

This is the smallest change that keeps the focus-after-insert path
robust without adding a third source of truth for "active cell".

### 4.5 Row-insert flow

The new row's `fieldDefaults` are sourced **from the anchor row** —
the row immediately above the insert point — not from a blank
`FieldDef.default` template. This matches Ed's chosen UX (Q1
resolution): Shift+Enter clones the row above so the new row is
already in valid shape; the user adjusts only what differs. The
consumer's `buildEmptyRow` is responsible for resolving uniqueness
constraints (Rooms: `number`) so the cloned row passes validation
at first commit (see §4.8).

```
on Shift+Enter from focused cell (rowId = R):
  if (!canInsertRow) → announce "Row insert not enabled." ; return
  if (edit.editing) {
    const committed = await edit.commit();
    if (!committed) return;     // validation blocked; abort cleanly
  }

  const tmpId = `tmp_${generatedId("row")}`;
  const anchorRow = filteredRows.find((row) => getRowId(row) === R) ?? null;
  const fieldDefaults = anchorRow
    ? extractRowDefaults(anchorRow, fieldDefs, visibleColumnDefs)
    : buildEmptyRowDefaults(fieldDefs);
  const newRow = buildEmptyRow({
    rowId: tmpId,
    fieldDefaults,
    anchorRow,
  });
  const firstEditableFieldKey = pickFirstEditableFieldKey(
    visibleColumnDefs, fieldDefByKey,
  );

  const op: WriteOp = {
    kind: "rowInsert",
    rows: [{ rowId: tmpId, fieldDefaults, anchorRowId: R }],
  };
  const inverse: WriteOp = {
    kind: "rowDelete",
    rows: [{ rowId: tmpId, row: newRow, anchorRowId: R }],
  };

  await dispatchWrite(op, inverse);

  if (firstEditableFieldKey) {
    edit.queuePendingEdit({ rowId: tmpId, fieldKey: firstEditableFieldKey });
  }
  announce("Row inserted.");
```

Notes:

- `buildEmptyRow` gains an optional `anchorRow` argument so the
  consumer can read fields the library doesn't model (Rooms:
  `erv_unit_ids`, `catalog_origin`, `notes`) directly from the
  anchor, *or* substitute its own defaults — consumer's choice.
- `pickFirstEditableFieldKey` scans visible columns in display
  order and returns the first whose
  `getFieldEditor(fieldDef).kind !== "none"` and `!fieldDef.read_only`.
  For Rooms with the default column order that's `number` — exactly
  the field most likely to need a user override after the clone,
  so the type-to-edit gesture (Phase 1) lands precisely where the
  user wants it.

Pure helpers added to `lib.ts`:

```ts
export function extractRowDefaults<TRow>(
  row: TRow,
  fieldDefs: FieldDef[],
  columns: DataTableColumnDef<TRow>[],
): Record<string, unknown> {
  const accessorByFieldKey = new Map(
    columns.map((column) => [column.fieldKey, column.accessor]),
  );
  return Object.fromEntries(
    fieldDefs.map((fieldDef) => [
      fieldDef.field_key,
      accessorByFieldKey.get(fieldDef.field_key)?.(row) ??
        fieldDef.default ??
        naturalZero(fieldDef.field_type),
    ]),
  );
}

export function buildEmptyRowDefaults(
  fieldDefs: FieldDef[],
): Record<string, unknown> {
  return Object.fromEntries(
    fieldDefs.map((fieldDef) => [
      fieldDef.field_key,
      fieldDef.default !== undefined
        ? fieldDef.default
        : naturalZero(fieldDef.field_type),
    ]),
  );
}

function naturalZero(fieldType: FieldType): unknown {
  if (fieldType === "text") return "";
  if (fieldType === "number") return 0;
  return null; // single_select, computed, attachment, argb_color
}
```

`buildEmptyRowDefaults` is retained as a forward-compat fallback
for the no-anchor case (currently unreachable through Shift+Enter
because the empty-state branch short-circuits the grid, but useful
for a future "insert at top" affordance and as the default for
consumers that don't pass an anchor).

### 4.6 Row-delete flow

```
on toolbar Delete click:
  open ConfirmRowDeleteDialog with count = rowSelection.count

on dialog Confirm:
  const targets = filteredRows.filter((row) =>
    rowSelection.isSelected(getRowId(row)),
  );
  const rows = targets.map((row, i) => ({
    rowId: getRowId(row),
    row,
    anchorRowId:
      i === 0
        ? indexAnchorOf(getRowId(row), filteredRows, getRowId)
        : null,
  }));
  const op: WriteOp = { kind: "rowDelete", rows };
  const inverse: WriteOp = {
    kind: "rowInsert",
    rows: rows.map(({ rowId, row, anchorRowId }) => ({
      rowId,
      anchorRowId,
      fieldDefaults: extractFieldDefaults(row, fieldDefs),
    })),
  };
  await dispatchWrite(op, inverse);
  rowSelection.clear();
  announce(`${rows.length} row${rows.length === 1 ? "" : "s"} deleted.`);
```

The inverse `fieldDefaults` is extracted from the row at delete
time so the inverse insert reconstructs the same values. For Rooms,
`extractFieldDefaults` reads each `fieldKey` from the row via the
column accessor; for fields not exposed in `fieldDefs` (e.g.
`erv_unit_ids`, `notes`), the consumer's `buildEmptyRow` is
responsible for falling back to its own defaults on restore. That
means undo of delete restores grid-visible fields exactly and
non-grid fields to their fresh-row defaults — acceptable for
Phase 2; flagged in §7.

### 4.7 Consumer adapter (Rooms)

Two responsibilities for `RoomsTable`:

1. Declare `FieldDef.default` slots so the no-anchor fallback path
   produces a valid row. (Used in the unreachable-today empty-table
   case and as a forward-compat slot.)
2. Implement `buildEmptyRow` so the cloned-from-anchor row is also
   valid — chiefly by remapping `number` to the next free value
   (anchor row's `number` would collide with the anchor itself).

`RoomsTable.tsx`:

```ts
const fieldDefs = useMemo<FieldDef[]>(
  () => [
    { field_key: "number", field_type: "text", display_name: "Number",
      required: true, default: "" },
    { field_key: "name", field_type: "text", display_name: "Name",
      required: true, default: "Untitled" },
    { field_key: ROOM_FLOOR_LEVEL_KEY, field_type: "single_select",
      display_name: "Floor", required: true, options: floorOptions,
      default: firstRoomFloorOptionId(roomsSlice) },
    { field_key: ROOM_BUILDING_ZONE_KEY, field_type: "single_select",
      display_name: "Zone", options: zoneOptions, default: null },
    { field_key: "num_people", field_type: "number",
      display_name: "People", default: 0 },
    { field_key: "num_bedrooms", field_type: "number",
      display_name: "Bedrooms", default: 0 },
    { field_key: "icfa_factor", field_type: "number",
      display_name: "iCFA", default: 1 },
    { field_key: "erv_unit_ids", field_type: "text",
      display_name: "ERVs", read_only: true },
  ],
  [floorOptions, zoneOptions, roomsSlice],
);

const buildEmptyRow = useCallback<NonNullable<DataTableProps<RoomRow>["buildEmptyRow"]>>(
  ({ rowId, fieldDefaults, anchorRow }) => {
    // Anchor-clone path: copy non-grid fields from the anchor, then
    // remap `number` to the next free value so the row passes
    // validateRoomsPayload at insert time.
    if (anchorRow) {
      return {
        ...anchorRow,
        id: rowId,
        number: nextFreeRoomNumber(roomsSlice.rooms, anchorRow.number),
      };
    }
    // No-anchor fallback (currently unreachable via Shift+Enter).
    return {
      id: rowId,
      number: String(fieldDefaults.number ?? ""),
      name: String(fieldDefaults.name ?? "Untitled"),
      floor_level: (fieldDefaults[ROOM_FLOOR_LEVEL_KEY] as string | null) ?? null,
      building_zone: (fieldDefaults[ROOM_BUILDING_ZONE_KEY] as string | null) ?? null,
      num_people: Number(fieldDefaults.num_people ?? 0),
      num_bedrooms: Number(fieldDefaults.num_bedrooms ?? 0),
      icfa_factor: Number(fieldDefaults.icfa_factor ?? 1),
      erv_unit_ids: [],
      catalog_origin: null,
      notes: null,
    };
  },
  [roomsSlice.rooms],
);
```

`nextFreeRoomNumber` is a small pure helper in `equipment/lib.ts`:

```ts
export function nextFreeRoomNumber(rooms: RoomRow[], from: string): string {
  // Tries `from + 1`, `from + 2`, … when `from` parses as a number;
  // for non-numeric anchors, falls back to `${from} (copy)` /
  // `${from} (copy 2)` until unique. Numbers compared after the same
  // trim/lowercase rule validateRoomsPayload uses for uniqueness.
  const taken = new Set(rooms.map((r) => r.number.trim().toLowerCase()));
  const parsed = Number(from);
  if (Number.isFinite(parsed) && from.trim() !== "") {
    for (let n = parsed + 1; n < parsed + 10_000; n += 1) {
      const candidate = String(n);
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }
  for (let i = 1; i < 1_000; i += 1) {
    const candidate = i === 1 ? `${from} (copy)` : `${from} (copy ${i})`;
    if (!taken.has(candidate.trim().toLowerCase())) return candidate;
  }
  return `${from}-${rowIdSuffix()}`;  // last-resort, rowIdSuffix is a 6-char ulid tail
}
```

Unit-tested in `equipment/lib.test.ts`.

`EquipmentTab.handleTableWrite`:

```ts
const handleTableWrite = async (op: WriteOp) => {
  if (!canEdit) return;
  if (op.kind === "cell" || op.kind === "paste") {
    /* existing path */ return;
  }
  if (op.kind === "rowInsert") {
    await commitRoomsPayload(
      roomsPayloadFromRowInsert(roomsSlice, op.rows, buildEmptyRow),
      ACTIVE_ROOM_CONFLICT_MESSAGE,
      "Could not insert room.",
    );
    return;
  }
  if (op.kind === "rowDelete") {
    await commitRoomsPayload(
      roomsPayloadFromRowDelete(roomsSlice, op.rows),
      ACTIVE_ROOM_CONFLICT_MESSAGE,
      "Could not delete rooms.",
    );
    return;
  }
};
```

The two new helpers in `equipment/lib.ts`:

```ts
export function roomsPayloadFromRowInsert(
  current: RoomsSlice,
  rows: RowInsertPayload[],
  buildEmptyRow: (args: {
    rowId: string;
    fieldDefaults: Record<string, unknown>;
  }) => RoomRow,
): RoomsReplacePayload {
  const inserted = rows.map(buildEmptyRow);
  return {
    rooms: sortedRooms([...current.rooms, ...inserted]),
    single_select_options: cloneOptions(current),
  };
}

export function roomsPayloadFromRowDelete(
  current: RoomsSlice,
  rows: RowDeletePayload[],
): RoomsReplacePayload {
  const toDelete = new Set(rows.map((r) => r.rowId));
  return {
    rooms: current.rooms.filter((r) => !toDelete.has(r.id)),
    single_select_options: cloneOptions(current),
  };
}
```

The inverse-of-delete dispatches a `rowInsert` whose `buildEmptyRow`
reconstructs the row from `fieldDefaults`. Non-grid fields
(`erv_unit_ids`, `catalog_origin`, `notes`) come from the consumer's
defaults — see §7 risk on lossy delete-undo.

### 4.8 Validation handshake

`validateRoomsPayload` rejects:

- blank `number`
- duplicate `number` (trim + lowercase)
- blank `name`
- null / missing `floor_level`

Cloning from the anchor row (§4.5) satisfies the first, third, and
fourth automatically — the anchor was already valid. The only
collision is on `number`, which would duplicate the anchor's value.
`buildEmptyRow` (Rooms — §4.7) remaps `number` via
`nextFreeRoomNumber(rooms, anchorRow.number)` so the inserted row
passes `validateRoomsPayload` on its first commit.

User flow:

1. User presses Shift+Enter on row "5" (name "Living", floor
   "Ground", iCFA 0.85).
2. Library clones values, dispatches `rowInsert`. The new row
   commits with `number = "6"` (next free), name "Living",
   floor "Ground", iCFA 0.85.
3. Library queues pending focus on the new row's `number` cell;
   pending-edit channel opens edit mode with intent `replace`.
4. User types `1` — Phase 1's type-to-edit replaces the draft.
   On Tab, "1" commits as the cell write.
5. If "1" collides with an existing row, `coerceFieldValue` /
   `validateRoomsPayload` reject the cell-write op and the
   user sees the existing inline-edit error path. The row
   itself is still in place with its (valid) `number = "6"`.

### 4.9 Toolbar redesign

Today the toolbar is a fixed status strip. Phase 2 extracts it into
`GridToolbar.tsx` with two slots:

```
┌────────────────────────────────────────────────────────────────┐
│ Editable · 1 filter · Ungrouped · Unsorted   [ Delete 3 rows ▾ ]│
└────────────────────────────────────────────────────────────────┘
```

The action area on the right shows the delete button only when
`rowSelection.count > 0`. The button is rendered by the library
(not slotted to consumers) since Phase 4 / Phase 5 will land
additional toolbar actions (filter / sort / option-manager) in the
same area.

### 4.10 Gutter redesign

`GridGutter.tsx`:

```
┌──────┐
│ ☐  1 │   ← checkbox is a separate hit target from the row number
└──────┘
```

The checkbox:
- `aria-label="Select row {N}"`
- `aria-checked={isSelected}`
- onClick: detects `event.shiftKey` / `event.metaKey` / `event.ctrlKey`
  and forwards mode to `rowSelection.toggle`.

The row number button keeps its existing `selectRow` behavior
(extends cell range across the row) — independent channel.

When `readOnly`, the checkbox is hidden (still rendering the number)
so the column width stays stable; alternative is to disable but hide
is simpler and matches AirTable's read-only treatment.

### 4.11 Test plan

Existing tests pass unchanged. New tests:

- `__tests__/useGridRowSelection.test.ts` (NEW):
  - `single` click replaces the set + sets anchor.
  - `shift` click extends contiguous block in visible-order from
    anchor to target.
  - `shift` click without an anchor falls through to `single`.
  - `cmd` click toggles a single row; anchor unchanged.
  - Set clears when the `rowIds` identity changes.
- `__tests__/rowInsert.test.ts` (NEW):
  - Shift+Enter dispatches `rowInsert` with the right
    `anchorRowId` and `fieldDefaults` (= the anchor row's values
    keyed by fieldKey).
  - The op pairs with a `rowDelete` inverse of identical `rowId`.
  - `pendingFocus` resolves to `edit.start({intent: "replace"})`
    once the new row appears in `rowIds`.
  - Shift+Enter from edit mode awaits commit; if commit returns
    false, no insert.
  - Shift+Enter when `buildEmptyRow` is undefined announces and
    does not dispatch.
  - Shift+Enter when `readOnly` is silent (no announce, no
    dispatch).
- `__tests__/extractRowDefaults.test.ts` (folded into `lib.test.ts`):
  - Cloned defaults read through column accessors and respect the
    visible-column fieldKey set.
  - Field defined in `fieldDefs` but absent from `columns` falls
    back to `FieldDef.default`, then to `naturalZero`.
- `__tests__/rowDelete.test.ts` (NEW):
  - Confirm dispatches one `rowDelete` containing all selected
    rows' data.
  - Inverse is one `rowInsert` reconstructing those rows'
    `fieldDefaults`.
  - The dialog Cancel button does not dispatch.
- `__tests__/GridToolbar.test.tsx` (NEW small):
  - Delete button absent at count 0.
  - Delete button visible + correctly-labeled at count ≥ 1.
- `lib.test.ts` extensions:
  - `buildEmptyRowDefaults` honors `FieldDef.default`.
  - `buildEmptyRowDefaults` falls back to natural-zero by
    field_type when `default` is absent.
- `frontend/src/features/equipment/lib.test.ts` extensions:
  - `roomsPayloadFromRowInsert` appends rows + preserves options.
  - `roomsPayloadFromRowDelete` removes by id + preserves options
    + preserves the order of surviving rows.
  - `nextFreeRoomNumber`: numeric anchor increments past taken
    values; non-numeric anchor uses `(copy)` / `(copy 2)` ladder;
    skips values already in use case-insensitively.

## 5. Execution order

Six steps. Each leaves the tree green (`make test`, `make
typecheck`, `make lint`). Commit per step.

### Step 1 — Type tightening + row-defaults helpers

- Tighten `WriteOp.rowInsert` / `WriteOp.rowDelete` per §4.2.
  Export `RowInsertPayload` / `RowDeletePayload` from `index.ts`.
- Add `buildEmptyRow?` to `DataTableProps` (with the
  `anchorRow: TRow | null` arg per §4.2).
- Add `extractRowDefaults`, `buildEmptyRowDefaults`, and
  `naturalZero` to `lib.ts` with tests in `lib.test.ts`.
- No behavior change; tree stays green.

### Step 2 — `useGridRowSelection` hook

- Implement the hook per §4.3.
- Add `__tests__/useGridRowSelection.test.ts`.
- Wire into `DataTable.tsx` but do not render anything yet.

### Step 3 — Gutter checkbox + GridToolbar extraction

- Extract the current inline `<div class="data-table-toolbar">`
  into `GridToolbar.tsx`. No behavior change yet.
- Update `GridGutter.tsx` with the checkbox per §4.10. Wire
  `rowSelection.toggle` with `mode` derived from the modifier
  keys. Hide checkbox when `readOnly`.
- Add minimal CSS rules under `data-table.css` (or wherever the
  existing rules live) for the checkbox column padding.
- Snapshot-style render tests cover the new gutter.

### Step 4 — Row insert flow (Shift+Enter)

- Install `ulid` if not already present (check `pnpm-lock.yaml`;
  prefer reusing the existing `generatedId` helper from
  `shared/lib/ids` to avoid a new dep). The library's `tmp_` row id
  is `tmp_${generatedId("row")}`.
- Extend `useGridKeyboard` with the Shift+Enter branch per §4.4.
- Extend `useGridEdit` with the `queuePendingEdit` /
  `consumePendingEdit` channel per §4.4.
- In `DataTable.tsx`, compose the insert flow per §4.5; add a
  `useEffect` keyed on `rowIds` that calls
  `edit.consumePendingEdit(rowIds)`.
- Add `__tests__/rowInsert.test.ts`.
- At this step, Shift+Enter against Rooms inserts a row, focuses
  the new `number` cell, and opens edit mode. Save still works.

### Step 5 — Row delete flow (toolbar + dialog)

- `pnpm add @radix-ui/react-alert-dialog` (verify
  `minimumReleaseAge` passes; if not, slip a day).
- Add `ConfirmRowDeleteDialog.tsx`.
- Render the Delete action in `GridToolbar.tsx`, gated on
  `rowSelection.count > 0`.
- Implement `roomsPayloadFromRowDelete` in `equipment/lib.ts`
  + tests.
- Wire `EquipmentTab.handleTableWrite` to dispatch on `rowDelete`.
- Add `__tests__/rowDelete.test.ts` + `GridToolbar.test.tsx`.

### Step 6 — Consumer wiring polish + demo walk

- Implement `roomsPayloadFromRowInsert` and `nextFreeRoomNumber`
  in `equipment/lib.ts` + tests.
- Wire `RoomsTable.buildEmptyRow` (anchor-clone path +
  no-anchor fallback) and the `FieldDef.default` slots per §4.7.
- Wire `EquipmentTab.handleTableWrite` to dispatch on `rowInsert`.
- Run `make typecheck && make lint && make test && make format`.
  Run `pnpm run build`.
- `pnpm run dev`, walk §10 end-to-end. Record pass/fail in §11.
- Commit any post-walk fixes as a final commit (Phase 0 needed
  three; Phase 1 needed one — expect ~1–2 here).

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `validateRoomsPayload` rejects the cloned row because its `number` duplicates the anchor's. | `buildEmptyRow` remaps `number` via `nextFreeRoomNumber(rooms, anchor.number)`. Unit-tested. |
| `nextFreeRoomNumber` falls into the `(copy)` branch (non-numeric anchor) and produces an ugly default like `"A1 (copy)"`. | Acceptable for Phase 2 — the user immediately type-to-edits the focused `number` cell to replace it. The default is visibly distinct from the anchor so the user knows what to fix. |
| Two users / two tabs both Shift+Enter from the same anchor and pick the same "next free" `number`. | `replaceRoomsMutation` is single-flight on the front end and the conflict path (`ACTIVE_ROOM_CONFLICT_MESSAGE`) already handles cross-tab divergence. Acceptable. |
| Delete-undo restores rows minus their non-grid fields (`erv_unit_ids`, `catalog_origin`, `notes`). | For Phase 2 this is acceptable — Rooms-the-feature treats those as v1.1+ slots and they're either always-empty in this release (`erv_unit_ids`) or non-user-facing (`notes`). Surfaced as a §13 open question whether to widen `RowDeletePayload.row` to a structural-clone of the TRow so the inverse is bit-perfect. |
| `tmp_` row id and the consumer's row id diverge if the consumer rewrites the id in its draft state. | `RoomsTable.buildEmptyRow` adopts the library's `tmp_` id unchanged. If a future consumer rewrites, the pending-focus channel will drop the focus (the rowId won't appear in `rowIds`) and we'll need to add an id-remap callback. Out of Phase 2 scope. |
| `useGridEdit.queuePendingEdit` races with the consumer's commit — the row never appears, or appears under a different id. | Pending entries auto-drop after one rows-effect cycle (≈ one microtask flush). User can re-press Shift+Enter; idempotent. |
| `@radix-ui/react-alert-dialog` install blocked by the 24-hour `minimumReleaseAge` policy. | Same playbook as Phase 1 Popover — slip a day, do not lower the policy. |
| The toolbar Delete action collides with future Phase 4 / 5 / 6 toolbar buttons. | The action slot is intentionally library-owned; subsequent phases extend `GridToolbar.tsx`, they don't re-introduce their own toolbars in consumers. |
| Multi-row select set persists across project switches and offers stale ids. | Hook clears when `rowIds` identity changes (same rule as `useGridHistory.clear`). Verified by test. |
| `commitRoomsPayload` is single-flight; a rapid `Shift+Enter`-then-edit sequence could land its first cell write before the insert mutation resolves, racing against `roomsSlice`. | `dispatchWrite` awaits `onWrite` before returning; the library awaits each dispatched op. The insert resolves before the pending edit gets a chance to commit. |
| Adding `default` to `FieldDef` for `floor_level` (the first option id) requires `roomsSlice` to be in scope when `fieldDefs` is built — currently `floorOptions` is read but `firstRoomFloorOptionId` is not. | One added import + one extra useMemo dependency. Mechanical. |

## 7. What this phase explicitly does not do

- No mouse-drag range selection (Phase 3).
- No fill handle / ⌘D / ⌘R (Phase 7).
- No bulk-edit of selected rows (e.g. "set floor_level for these 3
  rows"). Set selection drives only delete in Phase 2.
- No keyboard shortcut for delete (e.g. Delete / Backspace from a
  focused-not-editing cell). Delete is toolbar-only this phase.
- No paste-with-row-insert (clipboard rows pasted past the bottom
  of the grid grow the table). Deferred — paste-overflow currently
  blocks with a banner; that stays.
- No filter / sort toolbar popovers (Phase 4).
- No tints, no aggregations, no group accordion (Phase 6).
- No id-remap callback for consumers that rewrite the library's
  `tmp_` id. Library-generated id is adopted unchanged.
- No removal of the existing `RoomModal` add/delete paths. Both
  channels keep working; the library path is additive.
- No bit-perfect delete-undo (non-grid fields restore to consumer
  defaults). Flagged in §13.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — type tightening + `buildEmptyRowDefaults` | 1.0 | 1.5 |
| 2 — `useGridRowSelection`                     | 1.5 | 2.5 |
| 3 — gutter checkbox + GridToolbar extraction  | 1.5 | 2.5 |
| 4 — row insert flow (Shift+Enter)             | 2.0 | 3.0 |
| 5 — row delete flow (toolbar + dialog)        | 1.5 | 2.5 |
| 6 — consumer wiring polish + demo walk        | 1.0 | 1.5 |
| **Total** | **8.5** | **13.5** |

Parent plan budgeted 8–12; this estimate's high end pushes 1.5 hr
past, allowing for a Radix AlertDialog focus-trap rabbit hole or a
validation-default tweak.

## 9. Commit plan

One commit per step. Subject prefixes match the data-table
convention from Phases 0 and 1:

1. `feat(data-table): tighten rowInsert/rowDelete op payloads`
2. `feat(data-table): row-selection hook with single/shift/cmd modes`
3. `feat(data-table): gutter checkbox + GridToolbar extraction`
4. `feat(data-table): Shift+Enter row insert with pending-focus handoff`
5. `feat(data-table): toolbar row-delete with AlertDialog confirm`
6. `feat(equipment): wire Rooms to <DataTable> row insert/delete`
   (or `chore(data-table): Phase 2 demo fixes` if step 6 is only
   post-walk polish; the consumer wiring lands in step 4 / 5
   alongside the library work, with step 6 reserved for the demo
   walk and any final adjustments).

Each commit message body summarizes which files moved or what
semantics changed, plus a `Co-Authored-By:` trailer when paired.

## 10. Demo script

After Step 6, walk this end-to-end against Rooms in a fresh browser
session. Record pass/fail in §11.

1. `make dev` → Postgres up. `make backend` + `make frontend`.
2. Sign in, open any project, navigate to Equipment → Rooms.
3. **Insert below clones the anchor.** Pick a populated row —
   say row "5" with name "Living", floor "Ground", iCFA 0.85.
   Click into its `name` cell. Press Shift+Enter. A new row
   appears directly below with name "Living", floor "Ground",
   iCFA 0.85, and `number` auto-resolved to the next free
   value (e.g. "6"). Focus is on the new row's `number` cell;
   edit mode is open with draft = "6".
4. **Type-to-edit replaces the cloned number.** Press `1`.
   Draft becomes "1". Tab → cell commits "1" (assuming "1" is
   free). If a row already uses "1", the inline-edit error
   path announces the collision; the row stays in place with
   the original "6".
5. **Insert from edit mode (commit chain).** Click into a `name`
   cell, press `e` (edit mode opens with draft "e"), then
   Shift+Enter. The current edit commits "e" first, then a new
   row appears below. Verify both happened.
6. **Insert when editor mid-validation.** Click into `icfa_factor`
   on any row, press `5` (draft "5"; valid). Press Shift+Enter →
   commit lands, new row appears. Now click `icfa_factor` on
   another row, press `x` (draft "x"; will fail coercion to
   number on commit). Press Shift+Enter → commit fails (announce
   "iCFA must be a number." or similar), no new row inserted.
7. **Multi-row checkbox select.** Click the gutter checkbox on
   row 2. Row 2 highlighted, "Delete 1 row" appears in the
   toolbar. Shift+Click the checkbox on row 5 → rows 2–5 all
   selected, "Delete 4 rows". ⌘-Click row 3 → row 3 deselected;
   "Delete 3 rows". Click the checkbox on row 2 again → set
   collapses to just row 2; "Delete 1 row".
8. **Delete confirm.** With 3 rows selected, click "Delete 3
   rows". The AlertDialog appears. Default focus is Cancel.
   Press Esc → dialog closes, no delete. Re-open, click Delete
   → dialog closes, 3 rows removed, toolbar Delete action
   disappears, aria-live announces "3 rows deleted."
9. **Undo delete.** Press ⌘Z. The 3 rows reappear in their
   original positions (sort-by-`number` recovers them). The
   row-selection set stays empty (undo doesn't re-select).
10. **Undo insert.** Press ⌘Z again (or several more times for
    the inserts from steps 3–6). Each new row vanishes one at a
    time; cells that the user edited on those rows vanish too
    (because the row's history entry is one semantic gesture
    even though subsequent edits were separate ops — verify by
    inspecting that the rows-prop no longer contains them).
11. **Redo round-trip.** ⌘⇧Z restores everything in reverse.
    The first re-applied insert lands the row back with its
    original tmp id; the subsequent cell-edit ops re-apply
    against the same row.
12. **Read-only mode.** Sign in as a Viewer (or open a locked
    version). Verify the gutter checkboxes are hidden, the
    toolbar Delete action is hidden, and Shift+Enter is a
    silent no-op (no announce, no insert).
13. **Existing modal paths unchanged.** Click the top-of-page
    "Add room" button → RoomModal opens, fill in, save → row
    appears. Click an existing row → RoomModal opens (edit
    mode), delete from inside the modal → row gone. Both paths
    still work.
14. **Type-checks / lint / tests / build.** Run `make typecheck
    && make lint && make test && pnpm run build` in a separate
    terminal — everything clean.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — type tightening + buildEmptyRowDefaults | 2026-05-23 | ✅ | RowInsertPayload / RowDeletePayload + extractRowDefaults / buildEmptyRowDefaults / naturalZero shipped with tests. |
| 2 — useGridRowSelection | 2026-05-23 | ✅ | Single/shift/cmd modes + anchor + clear-on-rowIds-identity-change, with 10 dedicated tests. |
| 3 — gutter checkbox + GridToolbar | 2026-05-23 | ✅ | Always-visible checkbox alongside row-number; GridToolbar extracted with library-owned action slot. Existing DataTable.test.tsx Tab-order test updated for the renamed buttons. |
| 4 — Shift+Enter row insert | 2026-05-23 | ✅ | useGridEdit.queuePendingEdit / consumePendingEdit channel handles the focus handoff across the consumer's re-render cycle. |
| 5 — toolbar row-delete + AlertDialog | 2026-05-23 | ✅ | @radix-ui/react-alert-dialog @ 1.1.15. Toolbar action appears only when rowSelection.count > 0. |
| 6 — consumer wiring polish + demo walk | 2026-05-23 | ✅ | See post-walk addendum §13. |
| Phase 2 overall | 2026-05-23 | ✅ | All 12 acceptance criteria walked clean. |

## 13. Post-walk addendum (2026-05-23)

Three load-bearing changes surfaced during the Step 6 demo walk that
weren't anticipated in the original plan:

1. **`generateRowId` prop on DataTableProps.** Backend rejected the
   library's `tmp_<ulid>` row ids with a 422 because the Rooms
   schema enforces `^rm_[A-Za-z0-9_-]+$`. Q6 had deferred the
   id-strategy question; the demo forced the answer. Consumers now
   pass their own id factory (Rooms: `() => generatedId("rm")`).
   Library fallback remains `tmp_<ulid>`.

2. **`sessionKey` prop on DataTableProps.** Phase 0's
   `history.clear()` on `rows` identity changes also fired after
   every successful write (TanStack Query reidentifies the array on
   `setQueryData`), so undo never crossed the dispatchWrite round-
   trip. The library now prefers a consumer-supplied `sessionKey`
   (Rooms: `${projectId}:${versionId}:rooms`) and falls back to the
   rows-identity rule when absent. Pre-existing Phase 0 / Phase 1
   consumers continue to work; undo behavior across writes is
   strictly improved.

3. **Empty-state moved inside the grid wrapper.** Phase 0's
   `if (rows.length === 0) return <div class="data-table-empty">`
   short-circuited the wrapper `<div role="grid" onKeyDown>`, so ⌘Z
   couldn't fire after deleting the last row. The empty message now
   renders inside the `<tbody>` (GridBody distinguishes "filtered
   empty" from "source empty" via the new `totalRowCount` prop) and
   the grid wrapper stays mounted. The empty-state styling is
   unchanged.

A fourth small fix: `nextFreeRoomNumber` now returns the input
verbatim when free. Delete-undo dispatches rowInsert with the
deleted row's original `number`; the slice no longer holds it, so
the helper restores "1" instead of incrementing to "2". Covered by a
new regression test in `equipment/lib.test.ts`.

## 12. Open questions — resolved 2026-05-23

Ed walked the six open questions on 2026-05-23. Resolutions below.

1. **Defaults for the inserted row** — RESOLVED.
   Decision: **clone from the row above** (the anchor). Shift+Enter
   always inserts below, so the anchor is always present at
   gesture time. `number` is the only field that needs remapping
   (uniqueness); the consumer's `buildEmptyRow` calls
   `nextFreeRoomNumber(rooms, anchor.number)` to find the next
   free value. All other fields copy through verbatim. The
   no-anchor / `FieldDef.default` path is retained as a forward-
   compat fallback for future "insert at top" affordances.
2. **Delete-undo fidelity** — RESOLVED.
   Decision: ⌘Z of a `rowInsert` removes the entire row (the
   default — matches Ed's "Agree. Undo removes entire row"
   reading). ⌘Z of a `rowDelete` restores rows from
   `RowDeletePayload.row` via the consumer's `buildEmptyRow`;
   non-grid fields (`erv_unit_ids`, `notes`, `catalog_origin`)
   are rebuilt from the anchor or from consumer defaults rather
   than from the deleted row's exact pre-delete values. This is
   lossy in principle but lossless in Rooms-today because those
   fields are either v1.1+ slots or empty. Revisit when ERV /
   Pump / Fan consumers come online.
3. **AlertDialog primitive** — RESOLVED.
   Decision: `@radix-ui/react-alert-dialog`. Matches Phase 1's
   Radix-Popover precedent.
4. **Delete keyboard shortcut** — RESOLVED.
   Decision: NO Delete / Backspace shortcut. Toolbar button only.
5. **Gutter checkbox visibility** — RESOLVED.
   Decision: always-visible small checkbox + row number side-by-
   side.
6. **`tmp_` row-id prefix** — RESOLVED.
   Decision: library generates `tmp_${generatedId("row")}` and the
   consumer adopts it unchanged.
