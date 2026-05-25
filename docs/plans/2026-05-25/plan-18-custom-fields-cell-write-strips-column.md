---
DATE: 2026-05-25
TIME: bug-fix (completes plan-16 P3.5 cell-write half)
STATUS: Filed. Reproduces in dev against the current `main`. The
        plan-16 P3.5 schema-mutation add-field surface shipped, but
        the matching cell-write path extensions did not. As a
        result, the very first cell write against a freshly added
        custom column wipes the column from the table and silently
        drops the typed value. No error toast, no console message —
        the round-trip "succeeds" because the backend faithfully
        applies the malformed whole-table-replace payload the
        frontend sends.
PARENT-PLAN: docs/plans/2026-05-24/plan-16-custom-fields-phase-3-type-change-and-single-select.md
RELATED:
  - docs/plans/2026-05-24/plan-13-custom-fields-overview.md
    §3 D5/D12/D16/D19, §4.3 (backend shape), §4.4 (server-
    authoritative validation)
  - docs/plans/2026-05-24/plan-14-custom-fields-phase-1-document-shape.md
    §1.5 (validate_document_references extensions),
    §4.3 (RoomsSliceReplaceRequest accepts `custom_fields` verbatim)
  - docs/plans/2026-05-24/plan-15-custom-fields-phase-2-schema-editor.md
    (schema-mutation surface — works correctly; not in scope here)
  - docs/plans/2026-05-24/plan-16-custom-fields-phase-3-type-change-and-single-select.md
    P3.5 lines 1147–1153 (the exact extension this bug-fix
    implements verbatim, plus the gap below)
  - context/technical-requirements/data-table.md "Write Pipeline"
    (whole-table-replace contract — payload must carry the full
    table envelope, not a sparse delta)
---

# Plan 18 — Custom-field cell write strips the column

## 1. Reproduction

1. Editor opens the Equipment tab → Rooms `<DataTable>`.
2. Clicks the `+` add-field glyph; enters name `test`; leaves type
   as `Short text`; clicks `Add field`.
3. Backend accepts the typed `add` schema mutation. Column `TEST`
   renders at the tail. The slice's `custom_fields` now contains one
   `CustomFieldDef` with id `cf_<…>`.
4. Editor focuses the new column's cell on row 1, types `test`, and
   presses `Enter`.
5. **Bug:** the `TEST` column disappears entirely. The typed value
   is gone. No error UI, no console message, no network failure.
   Hitting Undo restores the column (the undo history still holds
   the schema mutation) but a second cell-write reproduces the wipe.

## 2. Root cause — two cooperating defects on the cell-write path

The schema-mutation surface (Phase 2) writes through
`POST /draft/schema-mutations` and is correct. The bug lives entirely
in the **whole-table-replace path** that handles ordinary cell /
paste / fill / row-insert / row-delete writes.

### 2.1 Bug 1 — `custom_fields` stripped on whole-table replace

`frontend/src/features/equipment/lib.ts` declares six builders that
all produce a `RoomsReplacePayload` consumed by
`useReplaceRoomsSliceMutation`:

| Builder | Triggered by |
|---|---|
| `nextRoomsPayload` | RoomModal Save |
| `deleteRoomPayload` | Row delete from modal |
| `roomsPayloadFromCellWrites` | Cell edit, paste, fill |
| `roomsPayloadFromRowInsert` | Shift+Enter row-insert |
| `roomsPayloadFromRowDelete` | Toolbar row-delete |
| `replaceRoomOptionsPayload` | Legacy single-select option editor |

All six return `{ rooms, single_select_options }`. None include
`custom_fields`. On the backend,
`backend/features/project_document/tables/rooms.py::RoomsSliceReplaceRequest`
declares:

```python
custom_fields: list[CustomFieldDef] = Field(default_factory=list)
```

…so a missing `custom_fields` is silently coerced to `[]`. Then
`apply_rooms_replace` (rooms.py:99-118) rebuilds the envelope from
`rooms_payload.custom_fields` wholesale:

```python
next_envelope = RoomsTableEnvelope(
    custom_fields=rooms_payload.custom_fields,  # = []
    rows=rooms_payload.rooms,
)
```

The column definition is lost on the next save. The reason this
wasn't noticed earlier: until plan-15 there were no custom fields in
the document, so the empty-list default was a no-op. Plan-16 P3.5
lit up the add-field path without retrofitting the replace-payload
builders.

This gap is **not** explicitly named in plan-16 P3.5 — that section
only calls out the `applyWriteToRoom` routing and the `newOptions`
namespacing (Bug 2 below). The replace-payload builders are the
unflagged half of the same fix.

### 2.2 Bug 2 — `applyWriteToRoom` silently drops `cf_*` writes

`frontend/src/features/equipment/lib.ts:373-392` is a hardcoded
ladder of core-field branches:

```ts
function applyWriteToRoom(room: RoomRow, fieldKey: string, value: unknown): RoomRow {
  if (fieldKey === "number" && typeof value === "string") return { ...room, number: value };
  // …seven more core-field branches…
  return room;  // ← any cf_* key falls through, silently
}
```

The `setCustomValue` accessor exists at
`shared/ui/data-table/lib/customFieldAccessor.ts:20` and is the
documented single entry point (plan-13 D12) for writing into
`row.custom`. `applyWriteToRoom` never calls it. Result: every
custom-field cell write — text, number, url, single_select — is a
no-op at the row-update step, even on the rare case where Bug 1
doesn't also wipe the column definition.

This is the verbatim defect plan-16 P3.5 lines 1147–1153 names:

> Extend the Rooms write payload path for custom field cell writes:
> `applyWriteToRoom` must route `cf_*` keys through
> `setCustomValue`, and `roomsPayloadFromCellWrites` must merge
> `newOptions[cf_id]` into `single_select_options["rooms.<cf_id>"]`.

### 2.3 Why the user sees no error

The slice-replace request **succeeds**. The backend type
(`RoomsSliceReplaceRequest`) accepts the payload because the missing
`custom_fields` defaults to `[]`. `apply_rooms_replace` runs
`validate_document` against a body where (a) the column is gone and
(b) the row has no `cf_*` key in `custom`, so the
`validate_document_references` checks added in plan-14 §1.5 ("each
key in `room.custom` must appear in `custom_fields`") see a
self-consistent zero state and pass. The response returns the new
slice, React-Query caches it, `useTableSchema` recomputes, the
column drops from the rendered grid. Nothing is "wrong" by the
backend's lights — it faithfully applied what the frontend asked
for.

## 3. Out of scope — what is **not** wrong

- **Server-side type validation.** Plan-13 D16 + plan-14 §1.5 keep
  the backend authoritative; per-`field_type` coercion lives in
  `validate_document_references` and the `coerce_custom_value`
  helper (extended per phase). The frontend does **not** type-guard
  cell writes in `applyWriteToRoom`; mistyped values are surfaced
  via the existing draft-conflict / `api_error` path.
- **Schema-mutation surface.** Add / rename / delete / duplicate /
  set-description all ride `POST /draft/schema-mutations` and are
  unaffected. Tests under
  `frontend/src/features/equipment/__tests__/RoomsTable.addField.test.tsx`
  and `RoomsTable.schemaEditor.test.tsx` continue to pass against
  the broken cell-write path because they never write a cell value.
- **MCP / downloads / diff.** All read paths consume
  `body.tables.rooms.custom_fields` directly; they're unaffected.

## 4. Fix

Three surgical edits in `frontend/src/features/equipment/lib.ts`,
plus the namespaced option-key extension plan-16 already specified.
Backend stays as-is — its contract was always
"`custom_fields` carries the full envelope verbatim" (plan-14
§4.3); the frontend just needs to honour it.

### 4.1 Thread `custom_fields` through every payload builder

Each of the six `RoomsReplacePayload` builders takes `current:
RoomsSlice` (or returns a payload directly). Each must include the
slice's current `custom_fields` in its return:

```ts
return {
  rooms: sortedRooms(rooms),
  single_select_options: options,
  custom_fields: current.custom_fields,  // ← add this
};
```

`RoomsReplacePayload.custom_fields` is already declared optional in
`frontend/src/features/equipment/types.ts:60`; just stop omitting
it. The slice's `custom_fields` array is a fresh reference per
React-Query response, so passing it through does not alias storage.

Builders that need this edit:

1. `nextRoomsPayload` (lib.ts:139)
2. `deleteRoomPayload` (lib.ts:161)
3. `roomsPayloadFromCellWrites` (lib.ts:242)
4. `roomsPayloadFromRowInsert` (lib.ts:174)
5. `roomsPayloadFromRowDelete` (lib.ts:199)
6. `replaceRoomOptionsPayload` (lib.ts:307)

### 4.2 Route `cf_*` keys through `setCustomValue` in `applyWriteToRoom`

`applyWriteToRoom` currently takes `(room, fieldKey, value)`.
Extend the signature to also receive the slice's `custom_fields` so
it can verify the field exists before writing (a key not present in
`custom_fields` would fail backend validation — fail fast on the
client too). Add a top-of-function branch:

```ts
import { isCustomFieldKey, setCustomValue } from "../../shared/ui/data-table";

function applyWriteToRoom(
  room: RoomRow,
  fieldKey: string,
  value: unknown,
  customFields: readonly CustomFieldDef[],
): RoomRow {
  if (isCustomFieldKey(fieldKey)) {
    const fieldDef = customFields.find((f) => f.id === fieldKey);
    if (!fieldDef) return room;  // schema drift — backend will re-validate
    return setCustomValue(room, { field_key: fieldKey }, value);
  }
  // …existing core-field ladder unchanged…
}
```

`applyWritesToRoom` (the loop caller, lib.ts:364) gets the same
`customFields` parameter and forwards it. `roomsPayloadFromCellWrites`
passes `current.custom_fields` in.

No per-type coercion on the client. Backend's
`validate_document_references` is the type guard (plan-13 D16,
plan-14 §1.5).

### 4.3 Accept `rooms.<cf_id>` in `isRoomOptionKey` (plan-16 verbatim)

`isRoomOptionKey` at lib.ts:402 currently returns `true` only for
the two core option keys. Extend it (or add a sibling helper) so
the `newOptions` / `removedOptions` merge in `roomsPayloadFromCellWrites`
also handles namespaced custom keys like `rooms.cf_palette`:

```ts
function isRoomsOptionKey(key: string): boolean {
  return isRoomOptionKey(key) || key.startsWith("rooms.cf_");
}
```

`cloneOptions` (lib.ts:357) only seeds the two core entries today;
the fix here is to spread the entire `current.single_select_options`
record so custom namespaced lists round-trip. This is required for
plan-16 P3.6 paste-into-custom-single-select but cheap to land now
to keep the replace-payload contract consistent.

## 5. Tests

All in `frontend/src/features/equipment/lib.test.ts` unless noted.

1. `roomsPayloadFromCellWrites_preserves_custom_fields` — given a
   slice with one `cf_text` field, write a value to a core cell;
   assert returned payload's `custom_fields` matches input.
2. `roomsPayloadFromCellWrites_writes_into_custom` — given a slice
   with `cf_text`, write `"test"` to that field on row 1; assert
   `payload.rooms[row1].custom[cf_text] === "test"` and
   `payload.custom_fields` is preserved.
3. `roomsPayloadFromCellWrites_drops_unknown_cf_key` — write to a
   `cf_xxx` not in `custom_fields`; assert the row is unchanged and
   `custom_fields` is still preserved (no synthesis).
4. `nextRoomsPayload_preserves_custom_fields`,
   `deleteRoomPayload_preserves_custom_fields`,
   `roomsPayloadFromRowInsert_preserves_custom_fields`,
   `roomsPayloadFromRowDelete_preserves_custom_fields`,
   `replaceRoomOptionsPayload_preserves_custom_fields` — five
   parallel one-line tests, one per builder.
5. `roomsPayloadFromCellWrites_preserves_custom_option_list` — given
   a slice with `cf_palette` (custom single_select) and a non-empty
   `single_select_options["rooms.cf_palette"]`, write a value to any
   core cell; assert the custom option list is preserved.
6. Component test —
   `frontend/src/features/equipment/__tests__/RoomsTable.customFieldCellWrite.test.tsx`:
   render `<RoomsTable>` with one custom `short_text` field; simulate
   typing a value into the cell and pressing Enter; assert the
   resulting `onWrite` `op` carries a `cf_*` `fieldKey` and after
   commit the column still renders and the cell shows the value.
7. E2E — extend
   `frontend/tests/e2e/custom-fields-phase-2.spec.ts` (or add a
   sibling `custom-fields-cell-write.spec.ts`) with the exact bug
   reproduction: add a short_text field, type into the cell, press
   Enter, expect the column **and** the value to persist; reload the
   page, expect both to survive.

## 6. Acceptance

- `pnpm test`, `pnpm run typecheck`, `pnpm run lint`,
  `cd backend && uv run pytest` all green.
- `make smoke` green.
- Manual Playwright MCP walkthrough mirrors §1 reproduction:
  - Step 1–3 unchanged (already passes).
  - Step 4–5: column persists, cell renders `test`, no console
    errors, no toast.
  - Page reload: column and value still present.
  - Undo (Ctrl+Z) once: cell value reverts to empty, column stays.
  - Undo again: column removed.

## 7. Risks / Notes

- **R1.** Bug 1 has been latent since plan-14 shipped — the empty-
  default-list behaviour was harmless until plan-15. Any in-flight
  Phase 3.6 / Phase 4 work that touches the replace-payload path
  needs to assume `custom_fields` is now always carried; rebase
  carefully.
- **R2.** The `applyWriteToRoom` signature change (adding
  `customFields`) propagates one level up through `applyWritesToRoom`
  and into `roomsPayloadFromCellWrites`'s call sites. Internal-only;
  no public type changes.
- **R3.** Other custom-field-capable tables planned in plan-16 P3.7+
  (ERVs, Pumps, Fans, Thermal Bridges) will land their own
  `*_lib.ts` with the same six builders; the registered contract
  pattern (plan-13 §4.3.1) does not yet share a payload-builder
  helper across tables. Worth filing a follow-up to extract a
  `withCustomFields(payload, slice)` helper once a second table
  opts in, so this footgun does not get re-introduced per table.
- **R4.** No backend changes. If a future contributor reorders
  fields in `RoomsSliceReplaceRequest` or removes the
  `default_factory=list`, this same class of bug would resurface as
  a 422 on every cell write — easier to spot, but still worth a
  comment at the field declaration noting the default exists for
  pre-Phase-2 fixtures and is **not** an instruction to omit
  `custom_fields` from real writes.

## 8. Estimated scope

One PR. ~30 LOC of production change in `lib.ts`, ~150 LOC of new
tests, plus one e2e spec. No backend, no migrations, no API surface
change, no view-state migration.
