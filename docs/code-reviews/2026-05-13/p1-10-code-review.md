---
DATE: 2026-05-13
TIME: 19:00 EDT
SCOPE: Code review of uncommitted P1-10 (Rooms full MVP on shared DataTable).
REVIEWER: Claude (Opus 4.7)
RELATED: docs/plans/01_IMPLEMENTATION-ROADMAP.md (P1-10);
         context/user-stories/30-tables-equipment.md (US-EQ-2,
         US-Builder-Tables);
         context/technical-requirements/data-table.md;
         context/technical-requirements/data-model.md;
         context/technical-requirements/api.md.
---

# P1-10 — Rooms Full MVP On Shared DataTable — Code Review

## Summary

The change moves Rooms onto the shared `<DataTable>` path with inline
text/number editing, a row-detail expander for notes, an `erv_unit_ids`
column, an app-modal delete confirmation, a default floor option for
new rooms, a frontend pre-flight validator, a backend hard-required
`floor_level`, and a keyed-slice contract for table downloads. Scope
fits P1-10 reasonably well, but several US-EQ-2 acceptance criteria
remain unimplemented and a few items in this slice diverge from the
spec or from the slice's own intent.

Overall: **direction-correct, ship-blocking issues are limited**, but
there are real correctness and architectural divergences worth fixing
before P1-11.

## What this slice covers vs. P1-10 scope

P1-10 "Includes" line:

> Default Rooms columns; validation; natural sort; add row; row-detail
> modal; inline edit where appropriate; delete; notes; JSON download;
> locked/Viewer behavior; iCFA factor handling; explicit
> no-sync-from-HBJSON posture.

| Item | Status in this diff |
|---|---|
| Default Rooms columns | Yes — full 8 columns including ERVs |
| Validation | Partial — see H1, H2 |
| Natural sort | Already present via `sortedRooms` |
| Add row | Yes — defaulted to first floor option |
| Row-detail modal | Yes — Notes moved behind expander per US-EQ-2 §4 |
| Inline edit where appropriate | Yes (text/number); see M1, M3 |
| Delete | Yes — moved to `ModalDialog` (good) |
| Notes | Yes |
| JSON download | Yes — keyed slice contract added (good) |
| Locked / Viewer | Already present (read-only path through DataTable) |
| iCFA handling | Already present (clamp + format) |
| No-sync-from-HBJSON posture | Already documented in tab copy |

Acceptance criteria from US-EQ-2 still **missing** (acceptable to defer
within P1-10 → P1-11/12, but not yet flagged in the roadmap entry):

- §5: `number` duplicate auto-suffix `(2), (3)` on add. Current
  behavior is reject-with-toast for both add and inline edit. The
  story explicitly calls for auto-suffix on add, reject on rename.
- §6: ERV referential-integrity (cascade clear) — out of scope until
  US-EQ-4 lands.
- US-Builder-Tables §16–17 single-select **cell popover** editor for
  `floor_level` / `building_zone` — still modal-only here. Inline
  edit only fires for `text`/`number`. Acceptable for now but the
  shared spec has this as a v1 contract.
- US-Builder-Tables §10 destructive `Dialog` is now in place (good),
  but `roomPendingDelete` modal lacks a `titleId` link — see N4.

## H — High-priority issues (fix before merge or before P1-11)

### H1. Inline-edit emits `value: null` for emptied numeric cells; row applier silently drops them

`DataTable.coerceInlineEditValue` returns `{ ok: true, value: null }`
when a non-required number field is cleared
(`frontend/src/shared/ui/data-table/DataTable.tsx:382-388`).

That `cell` write reaches `applyWriteToRoom` in
`frontend/src/features/equipment/lib.ts:253-262`, which only matches
`typeof value === "number"`. A `null` value silently no-ops, the
optimistic `mutateAsync` succeeds, and the cell appears unchanged —
without any user feedback. This is a silent failure surface and
contradicts the "preflight then commit" promise the data-table spec
makes (`context/technical-requirements/data-table.md` §Field
Definition Registry).

Either:

- treat numeric clears as `0` (matches `num_people` / `num_bedrooms`
  defaults), **or**
- have `applyWriteToRoom` reject the write so the user gets a real
  error, **or**
- block clears in coercion when no `null` is meaningful for that
  field (e.g. `num_people`, `num_bedrooms`, `icfa_factor` are
  conceptually non-nullable in `RoomRow`).

The room model itself does not allow `num_people: null`
(`features/project_document/document.py:46-49`), so the frontend
emitting `null` here is also wire-format-divergent — the backend
would 422 on save if the slice ever made the round trip.

### H2. Backend now hard-requires `floor_level`, but `Room.floor_level` is still `str | None`

`features/project_document/document.py:51` keeps
`floor_level: str | None = Field(default=None, ...)`, but
`ProjectDocumentV1._validate_rooms` (lines 139-141) now rejects
`None` at the document level. The two layers disagree about the
contract.

Two consequences:

1. The Pydantic field default of `None` becomes unreachable — every
   `Room(...)` constructed without an explicit `floor_level` will
   pass field validation but later fail the document validator. This
   confuses test fixtures and any future tool that builds a `RoomRow`
   programmatically.
2. **Saved-document forward compatibility:** any prior version that
   was accepted under the old "nullable" rule will now fail typed
   reads after this change. Per P1-03 the MVP contract is "raw
   project JSON remains downloadable", so users *can* recover, but
   this is still a silent break for existing local/staging data and
   should at minimum be called out in the lessons.

Recommend tightening `Room.floor_level` to `str = Field(...)` (no
default, no `| None`) so the two layers agree, or keeping nullability
at the field level and only enforcing required-ness when the option
list is non-empty (the user-story default-defer behavior).

### H3. `erv_unit_ids` column has no referential integrity at any layer

US-EQ-2 §2 specifies `erv_unit_ids` as "array of refs ... each id must
reference an existing `tables.equipment.ervs[*].id`". The diff stores
free-form strings parsed from a comma-separated text input in three
places:

- `RoomModal.tsx:170-181` (modal field),
- `lib.ts:263-271` (`applyWriteToRoom` for inline-table edits),
- `RoomsTable.tsx:124-135` (column accessor — `text` field type).

`validateRoomsPayload` does not check ERV references. Backend
`Room.erv_unit_ids` accepts `list[str]` of ULIDs without cross-table
validation.

US-EQ-4 (ERVs) is not in this slice, so a real multi-select cannot be
wired today. But shipping the column as a free-text comma list with
zero validation almost guarantees we ship broken refs into saved
documents that future US-EQ-4 work will then have to clean up. Two
acceptable paths:

- **Defer** the column entirely until US-EQ-4 ships and use the
  per-row modal as the only edit surface (matches US-EQ-2 intent
  better than a free-text column).
- **Keep the column read-only** in this slice (display only,
  `field_type: "text"` with `read_only: true`) so the inline-edit
  path can't introduce fake IDs.

The roadmap entry already calls this "MVP data"; the review just
notes that "MVP data" + free-text + no validation is the wrong
combination.

## M — Medium-priority issues

### M1. `handleTableWrite` accepts `kind: "fill"`, but `DataTable` never emits it

`EquipmentTab.tsx:155-156` allows `paste | cell | fill`, but the
shared `DataTable` only emits `paste` and `cell` writes (no fill
handle yet — explicitly deferred in P1-08 lessons). The branch is
dead code today and the `op.kind === "paste" ? op.newOptions : {}`
shape silently drops `newOptions` if a future `fill` write ever
included them. Either remove `fill` from the allow list until the
fill handle ships, or make the option-merging logic shape-agnostic.

### M2. Inline-edit error path leaves the editor open and re-uses `setAnnounce` for high-stakes errors

`commitInlineEdit` in `DataTable.tsx:180-203` writes the error
message to `setAnnounce` (an `aria-live="polite"` SR-only region) on
both validation and write failures. It does not close the editor and
does not surface the message visually. For backend rejects (e.g.
duplicate-number on inline `number` edit), the visible failure path
is the equipment tab's `actionError` banner, which is set inside
`handleTableWrite` *before* it re-throws — so the banner does fire,
but the SR announcement loses fidelity ("Could not update rooms
table values."). Either:

- forward `commitInlineEdit` errors to a visible inline error under
  the cell, or
- accept `actionError` as the canonical surface and skip the
  duplicated `setAnnounce(error.message)` call.

### M3. `Tab` while inline-editing escapes the cell without committing

`DataTable.tsx` calls `event.stopPropagation()` on the input's
keydown but does not handle `Tab`. The browser will move focus out
of the input to the next focusable element; React's `onBlur` clears
`editingCell` (line 334) without committing. This silently discards
the edit.

Spreadsheet expectation (and US-Builder-Tables §4: "Tab/Shift-Tab
moves cell-to-cell; Enter opens row-detail modal") is that Tab
commits and advances. Minimum fix: change `onBlur` to attempt a
commit, or handle `Tab` explicitly in the editor.

### M4. `validateRoomsPayload` re-implements rules already enforced by the backend

The frontend now mirrors the backend `_validate_rooms` rules
(duplicate number, missing floor option, missing zone option,
required floor). This is good for UX but creates two sources of
truth that will drift. Two suggestions:

- Add a brief comment in `lib.ts` linking to
  `features/project_document/document.py` so future maintainers know
  the rules need to track.
- Consider making `validateRoomsPayload` the single source the
  `RoomModal` *also* uses, instead of `RoomModal.save` re-doing
  required/duplicate checks at lines 46-61.

Currently the modal fails fast on its own `duplicateRoomNumber`
check, then `nextRoomsPayload` builds the payload, then
`validateRoomsPayload` runs the same checks again. The end-to-end
behavior is correct but there are three code paths to keep in
sync.

### M5. Default floor for new rooms uses array `[0]`, not "first by `option.order`"

`EquipmentTab.tsx:300` reads
`single_select_options[ROOM_FLOOR_LEVEL_KEY][0]?.id`. Per P1-09
lessons "Option reorder must preserve the manager's array order
before assigning new `order` values; sorting by single-select uses
`option.order` with nulls last." Today array order and `option.order`
agree because `normalizeOptionOrders` rewrites `order` from index
on every save. If that invariant ever breaks (e.g. an MCP write
reorders the array without renormalizing), the "first floor"
default will silently follow array order, not user intent.

Cheap fix: pick the option with the smallest `order`.

## L — Low-priority / consistency

### L1. `parseCommaList` duplicated between `RoomModal.tsx` and `lib.ts`

Both `RoomModal.tsx:219-224` and `applyWriteToRoom` in `lib.ts:266-270`
implement the same split/trim/filter for `erv_unit_ids`. Lift to one
exported helper to avoid drift (and to centralize the eventual
reference-validation hook).

### L2. `notes` is shown twice inside the `<details>`

`RoomModal.tsx:184-195` renders `<summary>Notes</summary>` then
`<label>Notes <textarea/></label>`. The duplicate label adds noise
both visually and to AT.

### L3. Roadmap entry says "Backend DB pytest/browser checks are pending because local Docker is not running."

Per P1-10 plan: "Browser check: Rooms edit/save/save-as/discard/lock/
download/diff flows still work after migrating off the stub". This
slice cannot be marked complete without that check. Worth bringing
Docker up and running the backend pytest suite before the next round
— H2 in particular is the kind of thing that integration tests catch
before a merge.

### L4. `tableDownloadUrl` shape changed from `[...]` to `{ "rooms": [...] }` — verify all downstream consumers

The `api.md` and `data-model.md` updates correctly reflect the new
shape. Confirmed test update at `test_project_document.py:573-576`.
Quick grep for any frontend code that fetches the table-download URL
and assumes an array-shaped body would be useful; I did not find any
in the diff, but a check is worth a few seconds.

### N — Nits

- N1. `DataTable.tsx:325` checks `editingCell.rowId === row.id` *and*
  the row/column index. The id check makes the index check redundant
  (rows with stable ids); the index check exists in case rows
  reshuffle while editing — fine, but worth a short comment so a
  future reader knows why the redundancy is intentional.
- N2. `validateRoomsPayload` returns the first failure as an English
  string. Acceptable for MVP, but the data-table spec asks for a
  structured `CoerceResult` shape; consider returning
  `{ rowId, fieldKey, message }` so the equipment tab can scroll to
  the offending row in a future iteration.
- N3. `EquipmentTab.tsx:295` "New room" title was previously "Add
  room"; harmless but worth confirming with copy guidelines (the
  rest of the app uses "Add …" for primary CTAs).
- N4. `roomPendingDelete` `ModalDialog` passes
  `titleId="delete-room-title"` but the modal body contains no
  matching `id`. Minor a11y nit.

## Architectural / spec divergences worth tracking

1. **`onWrite` typed as `void | Promise<void>`** but inline-edit code
   path now relies on it being a `Promise` to surface errors via
   `await onWrite(...)`. Type allows a synchronous void-returning
   handler that throws asynchronously — the Equipment tab handler
   throws synchronously, which works, but the contract is no longer
   "fire and forget". Consider tightening the type to `Promise<void>`
   so future consumers know they must `await` and propagate.
2. **Single-select inline edit deferred** — US-Builder-Tables §16
   "cell popover with search + create" is still modal-only. The
   inline-editable check (`isInlineEditableField`) explicitly
   excludes `single_select`. This is consistent with P1-09 lessons
   ("inline single-select cell editor … deferred"); just calling
   it out so it does not get dropped out of P1-12.
3. **Sort-by-option-order vs. cell-paste editing** — once
   single-select inline edit lands, the `value` shape on a `cell`
   write for `single_select` will need `option_id` not `label`,
   matching the existing paste path. The current `applyWriteToRoom`
   already handles `isNullableOptionId`, so the shape is ready, but
   the editor surface is not.
4. **FIFO write queue (`data-table.md` §Write Pipeline)** — P1-09
   already flagged this as deferred. Inline edit's `await
   onWrite(...)` and the existing `replaceRoomsMutation` give us
   accidental serialization at the React-component level today, but
   no real per-table FIFO queue. Fine to keep deferred; just don't
   assume current correctness scales to the fill handle.

## Security / performance

- Nothing security-sensitive in this slice. No new auth, scope, or
  storage paths.
- Performance: inline edit triggers a full Rooms `PUT` per cell
  commit, same as paste. Acceptable for MVP table sizes (US-EQ-2 is
  bounded by per-project rooms — typically tens, not thousands). At
  catalog scale this would not work, but catalog tables are not in
  P1-10.

## Suggested follow-up checklist before closing P1-10

- [ ] Resolve H1 (numeric clear → `null` round-trip).
- [ ] Resolve H2 (`Room.floor_level` field type vs. validator).
- [ ] Decide H3 (defer or read-only `erv_unit_ids` until US-EQ-4).
- [ ] Bring Docker up and run backend pytest + the Phase 1 browser
      smoke listed in the P1-10 plan.
- [ ] Decide whether US-EQ-2 §5 number auto-suffix on add lands here
      or in P1-11.
- [ ] Update `01_IMPLEMENTATION-ROADMAP.md` P1-10 line with verified
      browser check evidence and the H1/H2/H3 disposition.
