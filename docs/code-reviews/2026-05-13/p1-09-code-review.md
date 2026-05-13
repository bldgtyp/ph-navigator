---
DATE: 2026-05-13
TIME: review pass
SLICE: P1-09 — Single-Select Field And Option Manager
SCOPE: un-committed working-tree changes against `main` (`1f71241`)
REVIEWER: Claude (Opus 4.7)
---

# P1-09 Code Review — Single-Select Field And Option Manager

## Files In Scope

```
M docs/plans/01_IMPLEMENTATION-ROADMAP.md
M frontend/src/App.css
M frontend/src/features/equipment/components/RoomsTable.tsx
M frontend/src/features/equipment/lib.test.ts
M frontend/src/features/equipment/lib.ts
M frontend/src/features/equipment/routes/EquipmentTab.tsx
M frontend/src/shared/ui/data-table/DataTable.tsx
M frontend/src/shared/ui/data-table/index.ts
M frontend/src/shared/ui/data-table/lib.test.ts
M frontend/src/shared/ui/data-table/lib.ts
M frontend/src/shared/ui/data-table/types.ts
?? frontend/src/features/equipment/components/RoomOptionManager.tsx
```

P1-09 scope per the roadmap (line 224) and `30-tables-equipment.md`
criteria 16–17 / `technical-requirements/data-table.md`:

> Shared single-select field display/edit/paste/sort/filter behavior;
> option colors; duplicate prevention; missing-option warnings; header
> option manager for rename, reorder, recolor, delete, and
> merge/replace decisions.

This review treats inline single-select **cell editing** as the
acknowledged P1-09→P1-10 open question (per the lessons line on line
227 and the status note on line 604). It is flagged but not counted as
a regression.

## Summary

The slice lands the shape it claims: option metadata now lives on the
shared `FieldDef`, sort/filter/copy/paste all resolve labels through
the same registry, paste match-or-create emits a single `paste`
`WriteOp` whose `newOptions` are persisted alongside cell writes via
the existing replace-slice endpoint, and the header option manager
covers rename/reorder/recolor/delete with clear-or-merge replacement.
The split between the shared lib (typed coercion + clipboard/sort)
and the Rooms-specific payload composer (`roomsPayloadFromCellWrites`,
`replaceRoomOptionsPayload`) is the right shape — it keeps the
DataTable domain-free.

Issues below are organized **Must-fix** (correctness/data-loss),
**Should-fix** (PRD divergence or UX gap likely to bite in P1-10),
and **Nits**.

---

## Must-Fix

### M1 — `formatCellValue` returns the literal string `"Missing option"`, which round-trips through clipboard as a creatable option label

`shared/ui/data-table/lib.ts:301-306`:

```ts
export function formatCellValue(value: unknown, fieldDef: FieldDef | undefined): string {
  if (fieldDef?.field_type !== "single_select") return formatClipboardValue(value);
  if (value === null || value === undefined || value === "") return "";
  const option = fieldDef.options?.find((candidate) => candidate.id === value);
  return option?.label ?? "Missing option";
}
```

This same helper feeds:
- the cell renderer fallback (`DataTable.tsx:68`),
- TSV/HTML clipboard export (`rangeToTsv`, `rangeToHtml`),
- `applyTextFilters` value comparison,
- `compareSingleSelectValues` tie-breaker.

Copying a row that contains a missing-ref cell, then pasting it into
another single-select column, will run the literal string
`"Missing option"` through `coercePasteValue`, fail the case-insensitive
match against the existing options, and **create a new option labeled
"Missing option"** on the target column. That is a silent
data-corruption path against criteria 16's "Missing option fallback…
Save is blocked until the value is cleared or reassigned."

Recommendation: split display vs clipboard formatting. Clipboard
formatting for missing/unknown option ids should return `""`; the cell
renderer is already overridden in `RoomsTable` via
`optionPill`/`render`, so the renderer fallback inside `DataTable.tsx`
is the only display surface that needs the "Missing option" string,
and it should be a sentinel that paste/sort/filter explicitly treat as
empty.

### M2 — Save is not blocked when missing-option references exist

`30-tables-equipment.md` criterion 16:

> **Missing option fallback.** If imported/corrupt data references an
> `option_id` not present in the option list, the cell renders a
> warning pill and Save is blocked until the value is cleared or
> reassigned.

`RoomOptionManager.tsx:59-63` surfaces a "Missing" badge based on
`missingOptionReferences(...)`, which is good. But neither
`EquipmentTab` nor the project shell's Save action consults that
signal — Save proceeds normally with a row pointing at a non-existent
`option_id`. Combined with M1 above this is a real way to write
silently broken data back to the server.

Recommendation: lift the missing-ref check (per-table) into the
draft/Save gate and either block Save or force a recovery flow. At a
minimum, surface a banner-level "N rows reference deleted options"
explainer that ties into existing `draft-banner` styling.

### M3 — Required single-select can be cleared by the delete-with-replacement modal

`features/equipment/lib.ts:97-111` (`replaceRoomOptionsPayload`)
accepts `replacements: Record<string, string | null>` and happily
writes `null` into `room.floor_level` even though the PRD data-model
says `floor_level` is required (`30-tables-equipment.md:503`).

`RoomOptionManager.tsx:137-143` always offers "Clear referenced cells"
as the first option, regardless of `FieldDef.required`. Criterion 16
spells this out:

> Referenced required options are blocked until affected rows are
> reassigned or merged into another option.

Recommendation: thread `required` through to `RoomOptionManager` (the
`FieldDef` already has it but the manager isn't passed the full
FieldDef) and hide/disable the "Clear referenced cells" choice when
the field is required and the option has references. Today,
`floor_level` is being passed without `required: true` in
`RoomsTable.tsx:47` either — that should be set as part of this fix.

---

## Should-Fix

### S1 — Two parallel option-creation code paths with separately drifting palettes and id generators

- Shared:
  `shared/ui/data-table/lib.ts:380-392` — `generatedOptionId`,
  `nextOptionColor`, palette `["#3b82f6","#10b981","#a16207","#7c3aed","#0f766e","#be123c"]`.
- Equipment:
  `features/equipment/lib.ts:11-16,249-268` — `generatedId("opt")`,
  `OPTION_COLORS = ["#3b82f6","#10b981","#a16207","#7c3aed","#0f766e","#be123c"]`,
  separate `upsertOption`.

Both are exercised today: the modal save path goes through
`nextRoomsPayload → upsertOption` (equipment lib), while paste goes
through `coercePasteWrites → coercePasteValue` (shared lib). The
palettes and the option-id prefix happen to match today, but the
duplication is a future-bug-magnet: the next palette tweak,
case-folding rule, or id format change will land in one place and not
the other. This violates the data-table contract's
"`FieldDef`-driven" promise — single registry, single coercion.

Recommendation: put option creation in the shared lib (it already
has the typed coercion path), then have the equipment modal-save path
call the same helper. The equipment lib should be responsible only
for *mapping option ids onto its row schema*, not for inventing
options.

### S2 — `WriteOp.newOptions` is typed as `Record<string, unknown[]>`, defeating the FieldDef-driven contract

`shared/ui/data-table/types.ts:77` and
`data-table.md` line 162 say `Record<string, FieldOption[]>`. The
shared lib already returns `Record<string, FieldOption[]>` from
`coercePasteWrites`, so this is a deliberate widening at the public
boundary. The downstream consumer in `features/equipment/lib.ts:230`
re-validates each entry with `isSingleSelectOption(value)` — that
defensive runtime check is only necessary because the static type was
discarded.

Recommendation: tighten to `Record<string, FieldOption[]>` and drop
`isSingleSelectOption`. If a future consumer truly emits unknown
shapes, that's a sign the shape needs a different `WriteOp` kind, not
a widened existing one.

### S3 — `optionPill` looks up its `FieldDef` by hard-coded array index

`RoomsTable.tsx:87, 94`:

```ts
render: (room) => optionPill(room.floor_level, fieldDefs[2]),
...
render: (room) => optionPill(room.building_zone, fieldDefs[3]),
```

`fieldDefs[2]` and `fieldDefs[3]` happen to be the floor and zone
fields because of the literal order on lines 47-64. The instant
anyone reorders that array (or inserts a hidden field), pills
silently mis-resolve. Look up by `field_key`:

```ts
const floorField = fieldDefs.find((f) => f.field_key === ROOM_FLOOR_LEVEL_KEY);
```

— or compute `fieldDefByKey` once in `RoomsTable` like `DataTable`
already does internally.

### S4 — Header option manager UX diverges from criterion 17 in three places

`30-tables-equipment.md:215-235` specifies:

- **Drag-reorder** with handles (`react-aria-components DropZone` or
  equivalent). Implementation uses Up/Down buttons (`RoomOptionManager.tsx:96-111`).
- **Palette popover** for recolor. Implementation uses
  `<input type="color">` (line 77) — gives arbitrary colors instead of
  the documented token palette.
- **Sub-dialog** for delete-with-impact. Implementation shows it
  inline below the option list (lines 130-162).

None of these are data-loss bugs; the cluster matters because the
spec calls out a constrained palette for tinting tokens. Free-form
hex from `input[type=color]` will leak through `--option-color` into
CSS `color-mix(..., var(--option-color) ...)`, producing pills outside
the intended token set.

Recommendation: at minimum constrain the recolor UI to the same
palette `nextOptionColor` cycles through, and queue drag-reorder as an
acknowledged follow-up in the roadmap entry rather than letting it
slide silently. If it's intentional to defer all three to P1-10,
mark them in the P1-09 row's "remaining before closing" line so the
divergence is recorded.

### S5 — Inline single-select cell editing is missing

Criterion 16 explicitly requires a cell popover with search +
create. The slice notes acknowledge this:

> "Remaining before closing: review pass and decide whether inline
> single-select cell editing belongs in P1-09 or P1-10."

Without it, users can only set `floor_level` / `building_zone`
either via the row-detail modal or by pasting from the clipboard.
That's enough to validate the shared write pipeline, which is the
real P1-09 deliverable — but if this gets pushed to P1-10, the
acceptance row for criterion 16 stays unmet. Make a deliberate
decision and record it. (Recommendation: defer to P1-10 along with
the rest of Rooms inline editing — they're the same TanStack
editor-overlay primitive — and update the roadmap accordingly.)

### S6 — Concurrent mutations against the same draft can race the etag check

Three call sites all dispatch through `replaceRoomsMutation.mutate(...)`
without serializing: `handleTableWrite` (paste, `EquipmentTab.tsx:147`),
`saveOptions` (options manager, line 171), and `deleteRoom`
(line 130). React Query mutations don't coalesce by default; if a user
clicks "Save options" while a paste mutation is still in flight,
the second request will send the same `version_etag`/`draft_etag`
the first one already advanced and will 409 with `draft_etag_mismatch`,
forcing a `Reload draft` despite the user's intent being valid.

`data-table.md` is explicit:

> One table instance maintains a FIFO persistence queue per open
> draft. Do not send concurrent draft writes for the same table/draft.

Recommendation: either await the in-flight mutation before issuing a
new one, or queue them in `useReplaceRoomsSliceMutation` via TanStack's
`mutationKey` + `scope`/`MutationCache` so they serialize. Worth a
test that fires two `mutate` calls back-to-back and asserts the
second waits.

### S7 — Paste error reporting drops everything past the first failure

`DataTable.tsx:347-353` only announces the first error from
`coercePasteWrites`. `data-table.md:131-134` and criterion 16's "Paste
coercion errors are preflighted" require a structured paste-review
dialog with up to 25 failures plus an overflow count. The shared lib
already returns the full error array — what's missing is the dialog.

Acceptable as a P1-09→P1-10 hand-off if recorded; today it just
silently bottoms-out at the first error.

### S8 — `RoomOptionManager` draft state goes stale if the slice updates while the popover is open

`RoomOptionManager.tsx:25` initializes `draftOptions` once with
`useState(() => normalizeOptionOrders(options))`. `startEdit` resyncs,
but only on toggle — if the parent re-renders with new `options`
(e.g. a paste mutation completes mid-edit, or
`useRoomsDraftBroadcast` delivers a remote change), the popover
silently continues editing stale data and the user can clobber the
remote write.

Pattern parity with `RoomModal` would be a `useEffect` that resets
draft state when the `options` reference changes (or, simpler: a
remote-change banner inside the popover with a "Reload options"
button mirroring the existing `draft-conflict-banner`).

---

## Nits

### N1 — `data-table-shell:has(.room-option-popover)` couples the shared shell to a Rooms-specific class
`App.css:1071-1074` + `1140-1142` reach across the abstraction
boundary the slice is otherwise careful about. If a future table
uses the same `renderHeaderActions` slot for a non-`room-option-popover`
popover, it won't get the stacking-context bump. Generalize via a
shared marker class (e.g. `data-table-header-popover-open` toggled by
the popover) or a data-attribute on the column header. Also note
`:has()` is widely supported in 2026 baseline browsers; not a
concern for compatibility, just for layering.

### N2 — `optionSortRank` has two sentinel values (missing-id vs null)
`shared/ui/data-table/lib.ts:362-366` returns `MAX_SAFE_INTEGER` for a
missing-id and `POSITIVE_INFINITY` for null. Missing-ids therefore
sort *before* nulls. That's defensible (missing is louder than empty
and should stay near the user's eye) but worth either documenting in
a one-line comment, or collapsing to one sentinel if the distinction
doesn't matter.

### N3 — `nextRoomsPayload` re-sorts even on a no-op write
`features/equipment/lib.ts:65` always calls `sortedRooms(...)`.
Combined with `roomsPayloadFromCellWrites` also calling it
(line 94), `replaceRoomsSlice` will see "changes" any time a row's
position shifts. Probably already true in P1-08 and not a regression.

### N4 — `useState(() => normalizeOptionOrders(options))` runs every render to capture the lazy initializer's closure
Not a bug — the lazy initializer only fires on mount. But the
closure captures the *first* `options` reference. Combined with S8,
worth a comment.

### N5 — Test coverage gaps
The existing suite covers paste match/create, sort by option order,
and option rename/reorder/delete-with-replacement. Not covered:

- duplicate-label blocking inside `coercePasteValue` (two
  clipboard entries that fold to the same label),
- `RoomOptionManager`'s `hasDuplicateLabels` UI block,
- a missing-option recovery flow (related to M2),
- required-field delete blocking (related to M3),
- the FIFO-queue serialization (related to S6).

P1-09's "Tests" line lists these explicitly. Worth adding at least
the duplicate-paste case and a missing-recovery case before closing
the slice.

### N6 — `replaceRoomOptionsPayload` silently leaves rows pointing at deleted options when no replacement is provided
`features/equipment/lib.ts:106-109`:

```ts
if (!currentOptionId || !(currentOptionId in replacements)) return room;
```

The only caller today (`RoomOptionManager`) always passes a
replacement for the deleted option, so this is latent. But it's a
foot-gun for the next caller (e.g. a future bulk-import flow): a
silently-dropped option leaves rows with missing refs that then trip
M1 and M2. Either invert the API to take "the new option list and the
list of removed option ids" and require replacements explicitly, or
assert in dev that every removed id has a replacements entry.

---

## What Looks Right

- The decision to fold paste-created options into the same semantic
  `paste` write op (and persist them through the existing
  replace-slice endpoint) matches the data-table contract's "one
  gesture = one undo entry" rule and avoids a chatty option-PATCH
  story.
- Sorting through `option.order` with nulls-last is correctly
  implemented and tested.
- The `renderHeaderActions` slot on `DataTable` is a clean way to
  keep domain-specific UI out of the shared primitive while still
  letting it own header stacking and a11y.
- `applyWritesToRoom` correctly funnels through `applyWriteToRoom`
  for type-safe per-field dispatch — much better than a generic
  `Object.assign` that would be a `typeof` minefield.
- The fingerprint-based `remoteSliceChangesActiveRoom` keeps the
  draft-conflict UX precise without requiring deep-equals on the
  whole slice.

---

## Recommendation

**Do not close P1-09** without resolving M1, M2, M3 — they're real
correctness issues against criterion 16. S1 and S2 are worth doing
inside this slice because they touch the same code paths and
deferring them invites drift. S3 is a one-line fix.

S4, S5, S6, S7, S8 are acceptable as explicit hand-offs to P1-10 if
the roadmap entry is updated to record them. Today the slice's
"Remaining before closing" line only mentions inline cell editing —
add the rest so they don't get forgotten.
