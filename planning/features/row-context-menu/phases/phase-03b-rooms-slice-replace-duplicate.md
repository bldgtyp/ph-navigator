---
DATE: 2026-06-04
TIME: 17:00
STATUS: Done — landed 2026-06-04 on main
AUTHOR: Ed May / Claude
SCOPE: Rooms `rowDuplicate` via slice-replace. No backend endpoint.
       Mirrors the existing `roomsPayloadFromRowInsert` shape.
RELATED:
  - planning/features/row-context-menu/PRD.md §8
  - planning/features/row-context-menu/decisions.md D-1, D-2, D-10,
    D-11
  - planning/features/row-context-menu/phases/phase-03a-rowduplicate-op-and-materials.md
  - frontend/src/features/equipment/lib.ts
    (roomsPayloadFromRowInsert / roomsPayloadFromRowDelete)
  - frontend/src/features/equipment/routes/RoomsPage.tsx
  - frontend/src/features/equipment/components/RoomsTable.tsx
  - backend/features/project_document/routes.py (`PUT /draft/tables/{name}`)
---

# Phase 3b — Rooms slice-replace Duplicate

## P0. Why this slice

Phase 3a landed the `rowDuplicate` WriteOp contract. Rooms consumes
it without any backend work: the consumer's `onWrite` builds a new
slice payload by cloning the source `RoomRow`, then dispatches the
existing `PUT /api/v1/projects/{id}/draft/tables/rooms` slice-
replace mutation.

This is the **slice-replace consumer template**. Phase 3c follows
the same pattern for Pumps.

## P1. Acceptance — Phase 3b done when

1. Right-clicking any data row in the Rooms table opens the row
   menu with all four built-ins (Insert / Duplicate / Expand /
   Delete) plus the Phase 2 multi-row collapse behavior.
2. `Duplicate record` clones the source row directly below it. The
   new row's `name` is suffixed via `nextCopySuffix` — same series
   as Materials (`<root> (copy)`, `<root> (copy 2)`, …).
3. Custom field values, single-select option ids, and number+units
   values on the source row appear unchanged on the clone. (The
   slice-replace path round-trips through
   `normalizeRoomForPayload`.)
4. ⌘Z removes the cloned row cleanly (slice-replace consumers do
   not have the tmp-id ↔ real-id gap — the tmp id is the persisted
   id).
5. The cloned row is the active selection's row after the round-
   trip (consistent with the existing post-insert behavior).
6. `make ci` is green; Playwright e2e covers the Rooms duplicate
   happy path.

## P2. Files

### Modified

- `frontend/src/features/equipment/lib.ts`:
  - Add `nextCopySuffix(baseName, siblingNames)` TS helper
    (algorithm identical to the Python `next_copy_suffix`).
  - Add `roomsPayloadFromRowDuplicate(current, duplicates)`
    helper next to the existing
    `roomsPayloadFromRowInsert`.
- `frontend/src/features/equipment/routes/RoomsPage.tsx` (or
  wherever `onWrite` is composed for Rooms) — add the
  `case "rowDuplicate"` switch arm.
- `frontend/src/features/equipment/__tests__/lib.test.ts` — unit
  tests for `nextCopySuffix` + `roomsPayloadFromRowDuplicate`.
- `frontend/tests/e2e/row-context-menu-duplicate-rooms.spec.ts` —
  Rooms duplicate happy path.

## P3. Helper shapes

### `nextCopySuffix`

```ts
const COPY_RE = /^(.*?)\s*\(copy(?: (\d+))?\)$/;

/**
 * AirTable-parity " (copy)" / " (copy N)" suffix resolver.
 * Matches the backend `next_copy_suffix` in
 * `backend/features/catalogs/_shared.py` line-for-line so CRUD and
 * slice-replace consumers behave identically. If a third consumer
 * needs this, promote to `shared/lib/copySuffix.ts`.
 */
export function nextCopySuffix(baseName: string, siblingNames: Iterable<string>): string {
  const match = COPY_RE.exec(baseName);
  const root = match ? match[1] : baseName;
  const siblings = new Set(siblingNames);

  let candidate = `${root} (copy)`;
  if (!siblings.has(candidate)) return candidate;
  let n = 2;
  while (true) {
    candidate = `${root} (copy ${n})`;
    if (!siblings.has(candidate)) return candidate;
    n += 1;
  }
}
```

### `roomsPayloadFromRowDuplicate`

```ts
import type { RowDuplicatePayload } from "../../shared/ui/data-table/types";

export function roomsPayloadFromRowDuplicate(
  current: RoomsSlice,
  duplicates: RowDuplicatePayload[],
): RoomsReplacePayload {
  const rooms = [...current.rooms];
  const liveNames = new Set(rooms.map((r) => r.name));
  for (const dup of duplicates) {
    const source = dup.sourceRow as RoomRow;
    const newName = nextCopySuffix(source.name, liveNames);
    liveNames.add(newName);
    const clone: RoomRow = {
      ...source,
      id: dup.rowId,
      name: newName,
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

Notes:

- `dup.sourceRow as RoomRow` is the consumer-boundary cast — the
  WriteOp type carries `unknown` per PRD §6.
- `liveNames` accumulates across the duplicates array so a batched
  duplicate of two rows with the same source picks distinct
  suffixes — this is parity with how the AirTable UI handles
  multi-row duplicate gestures, even though v1 only duplicates one
  at a time.
- `normalizeRoomForPayload` already exists; the clone path reuses
  it to keep custom-field shape consistent with the insert path.

### `RoomsPage.tsx` `onWrite` switch arm

```ts
case "rowDuplicate": {
  const payload = roomsPayloadFromRowDuplicate(current, op.rows);
  await replaceRoomsSlice(payload);
  return;
}
```

## P4. Sequence

1. Add `nextCopySuffix` + its unit tests.
2. Add `roomsPayloadFromRowDuplicate` + its unit test.
3. Add the switch arm to Rooms' `onWrite`.
4. Verify the existing `default`-throws (or whatever the V1
   exhaustiveness pattern is) in Rooms no longer fires for
   `rowDuplicate`.
5. e2e.

## P5. Tests

### Vitest

- `nextCopySuffix`:
  - `nextCopySuffix("Living Room", [])` → `"Living Room (copy)"`.
  - `nextCopySuffix("Living Room", ["Living Room (copy)"])` →
    `"Living Room (copy 2)"`.
  - `nextCopySuffix("Living Room (copy)", ["Living Room (copy)"])`
    → `"Living Room (copy 2)"` (the source's own suffix is
    stripped before resolving).
  - `nextCopySuffix("Foo (copy 5)", ["Foo", "Foo (copy)", "Foo (copy 5)"])`
    → `"Foo (copy 2)"`.
- `roomsPayloadFromRowDuplicate`:
  - Single duplicate inserts a clone below the anchor.
  - Multi-duplicate inserts in the right order with distinct
    suffixes.
  - Custom-field values on the source survive through the clone.
  - `anchorRowId === null` appends at the end.

### Playwright e2e — `row-context-menu-duplicate-rooms.spec.ts`

- Open a project's Rooms table. Right-click a room, click
  `Duplicate record`. Assert the cloned row appears below, with
  `name = source + " (copy)"`, and the same custom-field values.
- ⌘Z removes the clone cleanly.

## P6. Out of scope

- Backend changes — explicitly D-1 (no per-row endpoint for
  slice-replace consumers).
- Pumps — Phase 3c.
- ERVs and Fans — still `PlaceholderEquipmentTable`; pick up the
  pattern when their real tables land.

## P7. Risks

- **`normalizeRoomForPayload` semantics on cloned rows.** Today
  the helper is called from the insert path with a freshly-built
  blank row plus the slice's `field_defs`. Calling it with a
  cloned source row should be fine, but verify the helper does
  not e.g. re-mint ids inside it (which would overwrite our tmp
  id). Mitigation: read the helper before invoking; if it
  re-mints ids, factor a `cloneRoomForPayload(roomRow,
  field_defs)` variant.
- **Slice-replace audit / history.** The slice-replace PUT lands
  one new row in the saved table; whatever audit pipeline the
  project_document write rides will see it as "table contents
  changed" rather than "row N duplicated." Acceptable; matches
  every existing rowInsert/rowDelete gesture on slice-replace
  consumers.
