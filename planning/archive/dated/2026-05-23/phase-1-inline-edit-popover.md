---
DATE: 2026-05-23
TIME: planning
STATUS: Draft implementation plan — awaiting Ed approval.
SCOPE: Phase 1 of the `<DataTable>` AirTable-parity plan. AirTable-style
       inline edit semantics (click → focus, type → edit) and a real
       single-select popover editor whose option creation lands together
       with the dependent cell write as one semantic op (PoC L6.5).
       Driven against Rooms (US-EQ-2). No other consumers touched.
PARENT-PLAN: planning/archive/dated/2026-05-23/datatable-airtable-parity.md
RELATED:
  - context/technical-requirements/data-table.md (canonical contract,
    Field Types §, Single-Select §, Inline Edit §)
  - context/user-stories/30-tables-equipment.md
    (US-Builder-Tables §16–17)
  - planning/archive/dated/2026-05-23/phase-0-foundation-refactor.md
    (architecture this builds on)
  - research/poc-plans/poc-lessons-for-real-build.md
    (L2.3, L3.3, L5.2, L6.5, L10.2)
---

# Phase 1 — Inline edit + single-select cell popover

## 1. Why this phase exists

Phase 0 left `<DataTable>` with the right plumbing — `useGridEdit`,
`useGridWriteReducer`, `useGridHistory`, stable-id selection — but the
**only inline-editable field types are `text` and `number`**, and the
gesture for entering edit mode is still **double-click**. Today a user
who clicks `floor_level` and starts typing sees nothing happen: the
keystroke is swallowed by the grid keyboard handler because
`single_select` is not in `isInlineEditableField`. The only way to set a
floor level is the row modal (US-EQ-2's pre-existing flow), which
defeats the table-first promise of US-Builder-Tables.

Phase 1 closes that gap:

1. Click semantics flip to AirTable's rule: single click focuses, the
   next printable character opens the editor and *replaces* the draft.
   `Enter` from focus opens the editor at end-of-value.
2. `single_select` becomes inline-editable through a real popover that
   filters the option list, supports keyboard navigation, and offers a
   `Create "<label>"` footer when nothing matches.
3. Option creation in (2) bundles with the cell write as one semantic
   `WriteOp` so a single ⌘Z reverts both halves (PoC L6.5).
4. The field-type → editor mapping moves out of `useGridEdit`'s hard-
   coded check and into a small registry on `FieldDef`, so Phases 4–6
   add operators / aggregations / popovers against the same shape
   (L2.3).

Everything else stays. Phase 0's hooks, types, and tests are preserved
unchanged unless explicitly enumerated below.

## 2. Binding constraints

1. **Library-only, plus the one allowed consumer ripple.** All UI work
   lands in `frontend/src/shared/ui/data-table/`. The single consumer
   file that *does* change is `frontend/src/features/equipment/routes/
   EquipmentTab.tsx`, because the `cell` `WriteOp` variant grows an
   optional `newOptions` payload (§4.3) and the existing handler must
   pass it through to `roomsPayloadFromCellWrites` (which already
   accepts that shape on the `paste` path). `RoomsTable.tsx` itself
   does not change.
2. **One semantic op per gesture (L6.1, L6.2).** Creating a new
   single-select option *and* writing the dependent cell is one
   `dispatchWrite(op, inverse)` call. ⌘Z reverts both halves; a second
   gesture in between does not split the entry (L6.5).
3. **Existing inverses stay correct.** Inverse of a text/number cell
   write is unchanged. Inverse of a single-select cell write *that
   created an option* removes that option and restores the previous
   cell value (§4.3 spells out the shape).
4. **No new keyboard or selection behavior**. Range drag, full-column
   select, fill handle, stacked filter/sort all stay out of Phase 1.
5. **No new dependencies beyond `@radix-ui/react-popover`** (per the
   parent plan §15.3, gated on Ed's pnpm `minimumReleaseAge` rule —
   verify the package is ≥24 h old at install time).
6. **No backend changes for Rooms.** Single-select options for Rooms
   already live in the project-document body
   (`body.single_select_options["rooms.floor_level"]`) and the existing
   `roomsPayloadFromCellWrites` already merges `newOptions` into that
   structure (the `paste` path uses it today). Phase 1 reuses that
   merge unchanged.
7. **Read-only stays read-only.** Fields with `read_only: true` and
   field types `computed` / `attachment` / `argb_color` are NOT
   editable in Phase 1. Pressing a printable key on them is a no-op
   (with an aria-live announce, per L5.2).

## 3. Acceptance criteria

"Phase 1 demo passed" means all twelve are true on a real browser walk
against Rooms.

1. **Single click focuses a cell.** No edit mode opens. (Already true;
   preserve.)
2. **Type any printable character on a focused text or number cell** →
   edit mode opens, the typed character *replaces* the prior value as
   the new draft. (New.)
3. **`Enter` on a focused text/number cell** → edit mode opens with the
   draft = current value, caret at end. The current `Enter` →
   `onRowOpen` behavior moves to a side-affordance (gutter click) and
   only fires when no editor exists for that field type. (Changed.)
4. **`Esc` from edit mode cancels** (already true). **A second `Esc`
   from a focused-but-not-editing cell clears focus**, returning to a
   no-selection state. (New — small ergonomic.)
5. **`Tab` / `Shift-Tab` from edit commits and moves** (already true
   for text/number). For single-select popover, Tab commits the
   currently highlighted option (or creates one if the search footer
   is the highlight) and moves. (Extended.)
6. **`Tab` past the last visible cell exits the grid** to the next
   focusable element on the page (L5.2). Today the grid wraps; Phase 1
   replaces wrap with bubble-on-boundary so screen-reader users escape
   the grid. (Changed.)
7. **Single-select popover** opens for `floor_level` and
   `building_zone` cells on type-to-edit / Enter / double-click. The
   popover:
   - shows a search input at the top with the current draft value;
   - lists existing options as colored pills (option.color), filtered
     by the draft;
   - `Up/Down` navigates, `Enter` picks, `Esc` cancels;
   - shows `Create "<label>"` as the last item when the trimmed draft
     does not match any option (case-insensitive, trim+lowercase per
     `findFieldOptionByLabel`).
8. **One semantic op for create-then-write** (L6.5). Creating a brand-
   new option assigns the next palette color and order, and the cell
   commits to the new option id in the *same* dispatched op. ⌘Z
   reverts both halves. ⌘⇧Z re-runs both halves.
9. **No double-create.** Typing a label whose trim+lowercase matches an
   existing option resolves to that existing option's id; no new
   option is created and the `newOptions` payload is empty.
10. **Read-only fields** (`erv_unit_ids` on Rooms, plus any field whose
    `field_type ∈ {computed, attachment, argb_color}` or
    `read_only: true`) ignore type-to-edit and Enter. The aria-live
    region announces "Field is read-only." once (no spam on repeat
    keys).
11. **All Phase 0 tests still pass** unchanged. New tests cover:
    `useGridEdit` type-to-edit replaces draft; `useGridEdit` Enter-to-
    edit preserves draft; single-select popover keyboard nav;
    create-flow emits one op; existing-label resolves without create;
    inverse of create-flow removes the option.
12. **`make typecheck`, `make lint`, `make test`, `make format` all
    clean.** `pnpm run build` succeeds. `pnpm run dev` walks the §10
    demo script without console errors.

## 4. Target architecture

### 4.1 File layout (after)

```
frontend/src/shared/ui/data-table/
  DataTable.tsx              shell + composition (still ≤ ~250 LOC)
  components/
    GridHeader.tsx           UNCHANGED
    GridBody.tsx             small edits — passes editorKind to cells
    GridGutter.tsx           UNCHANGED
    InlineCellEditor.tsx     UNCHANGED (text / number)
    SingleSelectPopover.tsx  NEW — popover editor for single_select
  hooks/
    useGridSelection.ts      UNCHANGED
    useGridKeyboard.ts       small edits — type-to-edit + Enter-to-edit
                             dispatch; double-Esc clears focus; Tab
                             boundary bubbles instead of wraps
    useGridEdit.ts           extended — accepts a draft + an editor
                             kind; commits via per-field-type strategy
    useGridHistory.ts        UNCHANGED
    useGridWriteReducer.ts   UNCHANGED (the op shape change happens in
                             types.ts; the reducer is op-shape-agnostic)
    useGridClipboard.ts      small edits — paste already carries
                             newOptions; align field with the new
                             unified cell-op shape (§4.3)
  fields/                    NEW directory
    registry.ts              NEW — getFieldEditor(fieldDef) lookup
    types.ts                 NEW — FieldEditor union, capability bundle
  lib.ts                     small edits — see §4.3
  types.ts                   WriteOp.kind="cell" gains optional
                             newOptions; FieldDef may gain editor hint
                             (forward-compat slot; default = derived
                             from field_type)
  index.ts                   exports SingleSelectPopover only if a
                             consumer asks; otherwise unchanged
  __tests__/                 existing tests preserved; new tests added
```

Notes on the `fields/` directory: this is the seed for the L2.3 typed
registry the parent plan calls "the meat of phases 4 / 6". For Phase 1
the registry has one entry beyond the trivial inline-input case
(`single_select` → popover) but the *shape* it locks in is what later
phases extend with filter operators, aggregations, and paste coercion.
Putting it under `fields/` from day one avoids a more painful relocation
in Phase 4.

### 4.2 Hook contract changes

**`useGridEdit`** — extend to hold a typed draft, not a string.

```ts
// Phase 0 shape (current):
export type EditingCell = {
  rowId: string;
  fieldKey: string;
  draftValue: string;
  originalValue: unknown;
};

// Phase 1 shape:
export type EditingCell = {
  rowId: string;
  fieldKey: string;
  originalValue: unknown;
  editor: {
    kind: "text" | "number";        // InlineCellEditor consumes
    draftValue: string;
  } | {
    kind: "single_select";          // SingleSelectPopover consumes
    searchText: string;             // what the user has typed
    highlightedOptionId: string | null;
                                    // the option currently arrow-
                                    // selected; null when the "Create"
                                    // footer is highlighted
  };
};
```

The `draft()` callback signature stays — it just takes the next
draftValue / searchText — but `useGridEdit` internally routes by
`editor.kind`. `commit()` returns `Promise<boolean>` as before.

A new `start()` arg captures intent:

```ts
type StartArgs = {
  rowId: string;
  fieldKey: string;
  initialValue: unknown;
  intent: "replace" | "extend";   // replace = type-to-edit; extend =
                                  // Enter / double-click (preserve)
};
```

`replace` clears the draft to either `""` (text) or the just-typed
character (handled by caller before calling `start`), while `extend`
seeds the draft from `initialValue` formatted as today.

**`useGridKeyboard`** — three additions, all sized to fit in the
existing dispatch shape:

```ts
// Already in the surface (Phase 0):
//   ArrowKeys + Shift, Tab, Home, End, ⌘A, ⌘C, ⌘Z / ⌘⇧Z

// New for Phase 1:
function onPrintableKey(event: KeyboardEvent): void {
  // Resolve the active cell + field def; if the field has an inline
  // editor, call edit.start({intent: "replace", initialValue: ""}) and
  // then edit.draft(event.key). For single_select, the draft is the
  // search text; for text, it's the cell value.
}

function onEnterToEdit(event: KeyboardEvent): void {
  // When edit is closed and the active cell has an inline editor,
  // call edit.start({intent: "extend", initialValue: <current>});
  // when no editor, fall through to onRowOpen.
}

function onSecondEsc(): void {
  // First Esc handled by InlineCellEditor / SingleSelectPopover.
  // When pressed on a focused-but-not-editing cell, clear selection.
}
```

`onPrintableKey` runs only when:
- `!edit.editing`
- `!readOnly`
- `event.key.length === 1` and not a modifier combo
- `event.ctrlKey === false && event.metaKey === false && event.altKey === false`

The Tab-boundary behavior changes in `useGridEdit.commitAndMove` and in
`useGridKeyboard`'s arrow handler: instead of clamping at
`columnCount - 1`, Tab off the last visible cell of the last row lets
the event continue (no `preventDefault`) so the browser's default tab
order moves focus to the next focusable element. Same for Shift-Tab on
(0, 0).

### 4.3 Type changes

**`WriteOp.cell`** gains optional `newOptions`:

```ts
// Before:
export type WriteOp =
  | { kind: "cell"; writes: CellWrite[] }
  | { kind: "paste"; writes: CellWrite[]; rowsInserted: unknown[];
      newOptions: Record<string, FieldOption[]> }
  // ...

// After:
export type WriteOp =
  | {
      kind: "cell";
      writes: CellWrite[];
      newOptions?: Record<string, FieldOption[]>;
      removedOptions?: Record<string, string[]>;
    }
  | { kind: "paste"; writes: CellWrite[]; rowsInserted: unknown[];
      newOptions: Record<string, FieldOption[]>;
      removedOptions?: Record<string, string[]> }
  // ...
```

`removedOptions` is what an inverse op carries when reverting a cell
write that created an option (the forward op has `newOptions: {…}`; the
inverse has `removedOptions: {[fieldKey]: [createdId]}` plus a normal
restore-previous-value `writes` entry).

The consumer (`EquipmentTab.handleTableWrite`) widens to:

```ts
const handleTableWrite = async (op: WriteOp) => {
  if (!canEdit || (op.kind !== "paste" && op.kind !== "cell")) return;
  const newOptions =
    op.kind === "paste"
      ? op.newOptions
      : (op.newOptions ?? {});
  await commitRoomsPayload(
    roomsPayloadFromCellWrites(
      roomsSlice,
      op.writes,
      newOptions,
      op.removedOptions ?? {},
    ),
    // ...
  );
};
```

`roomsPayloadFromCellWrites` is extended once to accept
`removedOptions: Record<string, string[]>` and to strip those option
ids from the relevant `single_select_options[fieldKey]` list before
applying writes. (Existing `paste` callers pass `{}`; they're
unaffected.)

**`FieldDef`** gains no required new field. The `editor` mapping lives
in `fields/registry.ts`:

```ts
// fields/types.ts
export type FieldEditor =
  | { kind: "none" }
  | { kind: "text" }
  | { kind: "number" }
  | { kind: "single_select" };

// fields/registry.ts
export function getFieldEditor(fieldDef: FieldDef | undefined): FieldEditor {
  if (!fieldDef || fieldDef.read_only) return { kind: "none" };
  switch (fieldDef.field_type) {
    case "text":          return { kind: "text" };
    case "number":        return { kind: "number" };
    case "single_select": return { kind: "single_select" };
    case "computed":
    case "attachment":
    case "argb_color":    return { kind: "none" };
  }
}
```

This is the seed registry. Phase 4 will hang `operators[]` off the same
field type, Phase 5 will hang `optionManager` off it, Phase 6 will hang
`aggregations[]`. Importantly: every consumer table reads `FieldDef`,
not the registry, so changing the registry is a one-place edit. There
is no `FieldDef.editor` slot — the registry derives it from the type.

### 4.4 Click + keyboard semantics matrix

| Gesture | Before (Phase 0) | After (Phase 1) |
|---|---|---|
| Single click on cell | Focus cell | Focus cell (unchanged) |
| Double-click on text/number cell | Open edit | Open edit (unchanged) |
| Double-click on single_select cell | `onRowOpen(row)` | Open popover |
| Double-click on read-only / computed cell | `onRowOpen(row)` | `onRowOpen(row)` (unchanged) |
| Type printable on text/number cell | (no-op) | Open edit, draft = typed char |
| Type printable on single_select cell | (no-op) | Open popover, searchText = typed char |
| Type printable on read-only cell | (no-op) | Announce "Field is read-only." |
| Enter on text/number cell | `onRowOpen(row)` | Open edit, draft = current value, caret at end |
| Enter on single_select cell | `onRowOpen(row)` | Open popover, searchText = "" |
| Enter on read-only cell | `onRowOpen(row)` | `onRowOpen(row)` (unchanged) |
| Esc on edit | Cancel edit | Cancel edit (unchanged) |
| Esc on focused-but-not-editing | (no-op) | Clear focus |
| Tab from text/number edit | Commit + move 1 cell forward; wrap at end | Commit + move 1 cell forward; **bubble at last cell** |
| Tab from single_select popover | n/a | Pick highlighted (or Create) + move 1 cell forward; bubble at last |
| Tab from focused-but-not-editing cell | Move 1 cell forward; wrap at end | Move 1 cell forward; bubble at last |

Backward-compat note: `onRowOpen` is no longer the default Enter
target. Consumers that depend on Enter-to-open-modal must explicitly
add a gutter click or shortcut. For Rooms today, double-click on a
read-only field still opens the modal, and that's the only path
`EquipmentTab` exposes. No consumer behavior regresses.

### 4.5 Single-select popover UX

Component: `<SingleSelectPopover>` in `components/`. Renders into a
Radix `Popover.Content` portal anchored to the cell.

Layout:

```
┌──────────────────────────────────┐
│ ┌────────────────────────────┐   │  ← search input (autoFocus)
│ │ Mez                        │   │     value = editing.editor.searchText
│ └────────────────────────────┘   │
│                                  │
│  ● Ground                        │  ← existing options filtered
│  ● 1st                           │     case-insensitive contains
│  ● 2nd                           │     pills colored by option.color
│  ● 3rd                           │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄    │
│  ＋ Create "Mez"                 │  ← only when no exact-trim+lower
└──────────────────────────────────┘     match exists
```

Behavior:
- Mounted only while `edit.editing?.editor.kind === "single_select"`
  and `edit.editing.rowId/fieldKey === thisCell`.
- The search input is autofocus on mount. Typing updates
  `editing.editor.searchText` via `edit.draft()`.
- Up/Down cycles `highlightedOptionId` over the filtered options, then
  the Create footer (if present), then back to top.
- Enter commits the highlighted target.
- Click on a pill commits that option.
- Click on Create footer commits the create-new flow.
- Esc cancels via `edit.cancel()`. Click outside cancels.
- Z-lane: Radix Popover.Content uses its own portal at document body,
  z-index 50 via `--z-popover: 50;`. This sits above the table's
  sticky chrome and below modals (≥100).

Commit flow (the single op, L6.5):

```
on commit-create-new(label):
  options       = fieldDef.options ?? []
  trimmed       = label.trim()
  existing      = findFieldOptionByLabel(options, trimmed)
  if existing:
    return commit-existing(existing.id)

  created       = createFieldOption(trimmed, options)  // existing helper
  op = {
    kind: "cell",
    writes: [{ rowId, fieldKey, value: created.id }],
    newOptions: { [fieldKey]: [created] },
  }
  inverse = {
    kind: "cell",
    writes: [{ rowId, fieldKey, value: originalValue }],
    removedOptions: { [fieldKey]: [created.id] },
  }
  dispatchWrite(op, inverse)
```

```
on commit-existing(optionId):
  if optionId === originalValue:
    edit.cancel(); return  // no-op
  op = { kind: "cell", writes: [{ rowId, fieldKey, value: optionId }] }
  inverse = { kind: "cell",
              writes: [{ rowId, fieldKey, value: originalValue }] }
  dispatchWrite(op, inverse)
```

### 4.6 Test plan

Existing tests **all** continue to pass without rewrites. Most live in
`__tests__/DataTable.test.tsx`; the `Enter` test currently asserts
`onRowOpen` is called — that test must change because Enter now opens
edit mode on editable fields. Specifically:

- `DataTable.test.tsx` Enter test: update the cell under test to be a
  read-only field (so Enter still routes to `onRowOpen`), OR add a
  parallel test asserting Enter opens edit mode on a text cell. Both;
  see §5 Step 5.

New tests:

- `__tests__/useGridEdit.test.ts` (NEW file):
  - `start({intent: "replace"})` clears draftValue, type-to-edit
    inserts the typed character.
  - `start({intent: "extend"})` seeds draftValue from initialValue.
  - `commit()` on text routes to `dispatchWrite` with the cell op and
    inverse (matches Phase 0 contract).
  - `commit()` on single_select with an existing label resolves
    without `newOptions` in the op.
  - `commit()` on single_select with a new label includes
    `newOptions[fieldKey] = [created]` AND inverse includes
    `removedOptions[fieldKey] = [created.id]`.
  - `commit()` on single_select with the highlighted Create footer
    creates the option with the next palette color/order.
- `__tests__/SingleSelectPopover.test.tsx` (NEW):
  - Renders existing options as pills with their option.color.
  - Filters by trim+lowercase contains.
  - Up/Down navigates filtered list + footer.
  - Enter on highlighted-option commits that option.
  - Enter on highlighted-footer commits the create flow.
  - Esc / click-outside cancels.
- `__tests__/useGridKeyboard.test.ts` (NEW):
  - Type-to-edit fires `edit.start({intent:"replace"})` when active
    cell has an editor.
  - Type-to-edit on read-only cell announces and does not start.
  - Enter on editable cell starts edit (extend).
  - Enter on read-only cell routes to onRowOpen.
  - Second-Esc on focused-not-editing cell calls `selection.collapse`.
  - Tab from last cell does NOT preventDefault (bubbles).
- `__tests__/cell-op-shape.test.ts` (NEW small):
  - The new `newOptions` / `removedOptions` slots are optional and
    backward-compatible: a `kind: "cell"` op without them still
    type-checks and processes through `useGridWriteReducer`.

## 5. Execution order

Six steps. Each leaves the tree green (`make test`, `make typecheck`,
`make lint`). Commit per step.

### Step 1 — `fields/` registry + WriteOp type changes

- Create `fields/types.ts` and `fields/registry.ts`. Export
  `getFieldEditor`.
- Widen `WriteOp.cell` and `WriteOp.paste` with optional `newOptions` /
  `removedOptions`. Update `useGridClipboard` paste path so its forward
  op already includes `newOptions` (it does today — confirm; no logic
  change) and its inverse includes the corresponding `removedOptions`.
- Update `EquipmentTab.handleTableWrite` to pass `op.newOptions` /
  `op.removedOptions` into `roomsPayloadFromCellWrites`.
- Extend `roomsPayloadFromCellWrites` (in
  `frontend/src/features/equipment/lib.ts`) to accept and apply
  `removedOptions`. Cover with one test in `lib.test.ts`.
- All Phase 0 tests still green.

### Step 2 — Generalize `useGridEdit` for typed drafts

- Split `EditingCell.editor` into the discriminated union shape from
  §4.2.
- `start({intent})` honors `replace` vs `extend`.
- `commit()` becomes a switch on `editor.kind`. Phase 1 implements
  `text`, `number`, `single_select`. Other kinds throw an explicit
  "not implemented" error so a future bug surfaces loudly.
- The single-select commit path uses the create / resolve flow from
  §4.5.
- `isInlineEditableField` is deleted; callers use
  `getFieldEditor(fieldDef).kind !== "none"`.
- New `useGridEdit.test.ts` covers the matrix in §4.6.
- `DataTable.tsx` adapts to the new types; existing tests still pass.

### Step 3 — `SingleSelectPopover` component + render in `GridBody`

- Install `@radix-ui/react-popover` via `pnpm add @radix-ui/react-popover`.
  Verify it satisfies the 24-hour `minimumReleaseAge` policy at install
  time (`pnpm-workspace.yaml` already enforces this; if pnpm rejects
  the install, defer Phase 1 a day, do not bypass).
- Create `components/SingleSelectPopover.tsx` per §4.5.
- `GridBody` chooses the editor at render time: when
  `edit.isEditingCell(rowId, fieldKey) && edit.editing`, switch on
  `editor.kind` and render either `<InlineCellEditor>` or
  `<SingleSelectPopover>`. The popover anchors to the `<td>` so it
  positions correctly under horizontal scroll.
- The cell's static render (when not editing) is unchanged — the pill
  is already produced by `RoomsTable`'s column `render`.
- Add `SingleSelectPopover.test.tsx`.

### Step 4 — Type-to-edit, Enter-to-edit, second-Esc, Tab bubble

- Extend `useGridKeyboard` with `onPrintableKey`, the Enter-to-edit
  branch, the second-Esc branch, and the Tab-boundary bubble change.
- The `onPrintableKey` arm needs access to the active cell's field def
  to decide what to do. Pass `fieldDefByKey` and `rowIds` /
  `fieldKeys` resolvers into the keyboard hook so it can look up the
  active cell's `FieldDef`. The hook stays the only DOM-event hook;
  resolution stays a pure function.
- New `useGridKeyboard.test.ts` covers each branch.
- Existing `DataTable.test.tsx` Enter test moves to a read-only field
  to keep its `onRowOpen` assertion valid; a parallel test added for
  the editable-field path.

### Step 5 — Aria-live + read-only-key announce + small polish

- Read-only key announce: when a printable key arrives on a read-only
  cell, the existing `setAnnounce` channel announces "Field is
  read-only." Throttle (announce only when the message differs from
  the current) so repeated keys don't spam screen readers.
- Popover-open announce: "Editing <field display name>." fires on
  popover mount (single_select) and on InlineCellEditor mount.
- `aria-haspopup="listbox"` and `aria-expanded` on the underlying cell
  whose popover is open, for AT discoverability.
- Update the toolbar's status row if it reads inline-edit state
  (probably no change needed).

### Step 6 — Demo walk + sign-off

- Run `make typecheck && make lint && make test && make format`. Run
  `pnpm run build`.
- `pnpm run dev`, walk §10 end-to-end. Record pass/fail in §11.
- Commit any post-walk fixes as a final commit (e.g., the Phase 0
  pattern surfaced three fixes; expect ~1–2 here too).

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Radix Popover's built-in focus trap interferes with our Tab-to-commit-and-move semantics. | Use `<Popover.Content onOpenAutoFocus>` / `onCloseAutoFocus` to manage focus return; intercept Tab on the popover's search input and route to `edit.commitAndMove(shiftKey)` explicitly. The popover's tabbable surface is the search input plus the option list — both handled by our keyboard branch, not Radix's trap. |
| Type-to-edit racing with `onKeyDown`'s arrow handler — a stray printable that the browser also interprets as a shortcut. | `onPrintableKey` only fires when `event.key.length === 1` and no modifier (ctrl/meta/alt) is held. Letter+shift (capital A) is still a printable; that's intentional. Tested explicitly. |
| Changing Enter from "open row modal" to "open inline edit" silently regresses a path Ed muscle-memorized in Phase 0. | Loud in §4.4 and §10; Ed walks the matrix during the demo. If we want a row-modal shortcut, a follow-up adds a gutter-click / context-menu affordance — out of Phase 1 scope. |
| The `cell` op now has two new optional fields; consumers that don't expect them may pass stale state through. | `EquipmentTab` is the only `onWrite` consumer today; updated in Step 1. A grep in CI/lint scope verifies no other handler exists. The fields are *additive* and *optional* on the op union; old handlers that only read `writes` still work. |
| Inverse with `removedOptions` is hand-built — easy to drift if the create logic adds more option fields in the future. | Centralize the inverse builder in `useGridEdit`'s single-select commit (one function). Unit-test the round-trip: dispatch op → dispatch inverse → state matches pre-op state. |
| Single-select popover anchoring breaks when the table horizontally scrolls. | Radix `Popover.Anchor` attaches to the `<td>` — it scrolls with the cell. Visual check during the demo (§10 step 5 specifically exercises this). |
| `@radix-ui/react-popover` install fails the 24-hour `minimumReleaseAge`. | If `pnpm add` rejects, slip Phase 1 start by a day. Do NOT lower the minimum-age policy. (This is one of the binding global supply-chain rules.) |
| `roomsPayloadFromCellWrites` accepting `removedOptions` could collide with a `replaceRoomOptionsPayload` operation that's already mid-flight. | They share the same draft-buffer commit channel (`commitRoomsPayload`), which is single-flight on the front end. No new concurrency hazard. Phase 5's option-manager modal becomes the second path that emits `removedOptions`; that's the next time to re-test this code, but it's fine for Phase 1. |
| The "second Esc clears focus" gesture conflicts with users who expect Esc to do nothing on a focused-not-editing cell. | This is the AirTable behavior and is one of the L5.2 a11y notes. Document in §10; flag if Ed wants it deferred. |

## 7. What this phase explicitly does not do

- No mouse-drag range selection (Phase 3).
- No fill handle / ⌘D / ⌘R (Phase 7).
- No multi-select field type. Single-select only.
- No option manager modal (reorder / recolor / rename / delete with
  impact). The existing `<RoomOptionManager>` header-action stays.
  Phase 5 replaces it with a generic `<DataTable>`-level modal.
- No long-text or attachment inline editor. Those fields stay
  read-only in the grid; double-click still routes to `onRowOpen`.
- No filter / sort toolbar popovers (Phase 4).
- No tints, no aggregations, no group accordion (Phase 6).
- No new field types. The registry has room for them; none are added.
- No backend schema changes. Single-select options for Rooms continue
  to live where they live.
- No persisted view state. View state stays in-memory per session.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — registry + WriteOp widening | 1.5 | 2.5 |
| 2 — typed-draft `useGridEdit`    | 2.0 | 3.5 |
| 3 — `SingleSelectPopover` + GridBody wiring | 3.0 | 4.0 |
| 4 — keyboard semantics + Tab bubble | 2.0 | 3.0 |
| 5 — aria-live polish | 0.5 | 1.0 |
| 6 — demo walk + fixes | 1.0 | 1.5 |
| **Total** | **10.0** | **15.5** |

The parent plan budgeted 10–14; this estimate's high end pushes 1.5 hr
past, allowing for a Radix-focus-trap rabbit hole in Step 3.

## 9. Commit plan

One commit per step. Suggested subject prefixes (matching the data-
table convention from Phase 0):

1. `feat(data-table): widen WriteOp cell op with newOptions/removedOptions`
2. `refactor(data-table): typed editor draft in useGridEdit`
3. `feat(data-table): single-select cell popover (Radix)`
4. `feat(data-table): type-to-edit, Enter-to-edit, Tab boundary bubbles`
5. `chore(data-table): aria-live announces for edit + read-only`
6. `chore(data-table): Phase 1 demo fixes` (only if needed)

Each commit message body summarizes which files moved or what semantics
changed, plus a `Co-Authored-By:` trailer when paired.

## 10. Demo script

After Step 6, walk this end-to-end against Rooms in a fresh browser
session. Record pass/fail in §11.

1. `make dev` → Postgres up. `make backend` + `make frontend`.
2. Sign in, open any project, navigate to Equipment → Rooms.
3. **Click semantics.** Click into a `name` cell — focus border
   appears, no editor opens. Press `n` — editor opens, draft = "n".
   Type `ook`, press Enter — cell commits "nook" (or whatever).
4. **Enter-to-edit.** Click another `name` cell. Press Enter — editor
   opens with the current value, caret at end. Type ` Annex`, Tab —
   cell commits, focus advances to `floor_level`.
5. **Single-select popover, existing option.** With `floor_level`
   focused, press `g` — popover opens, search = "g", "Ground" is the
   filtered match. Press Down to highlight, Enter — cell commits to
   Ground; pill renders in the option color.
6. **Single-select popover, create new.** Move to another row's
   `floor_level`. Press `m`, then `e`, then `z`. The popover shows no
   existing match; the footer reads `Create "mez"`. Press Down to
   highlight the footer, Enter — option created with next palette
   color; pill renders.
7. **One-op undo (L6.5).** Press ⌘Z. The cell reverts to its prior
   value AND the new "mez" option is gone from the filter list. Open
   the popover on another row to confirm "mez" is no longer
   selectable.
8. **One-op redo.** Press ⌘⇧Z. The option is re-created AND the cell
   re-assigned.
9. **Trim-and-lowercase resolve.** Move to another row's
   `floor_level`. Press `M`, then `E`, then `Z`. The footer should
   read NOT `Create "MEZ"` but instead the existing "mez" option
   should be filtered in (because trim+lowercase matches). Highlight
   "mez", Enter — cell commits. No new option created.
10. **Read-only ignore.** Move to `erv_unit_ids` (read-only). Press
    `x`. No editor opens. The aria-live region announces "Field is
    read-only." (Verify via the live region in DevTools.)
11. **Double-Esc clears focus.** Click a cell. Press Esc once — no
    visible change (no edit was open). Press Esc again — the focus
    outline disappears.
12. **Tab past last cell bubbles.** Click into the last visible cell
    (`erv_unit_ids` of the last row). Press Tab. Focus leaves the
    grid wrapper for the next focusable element (likely the project
    shell tab bar). Phase 0 wrapped here; Phase 1 should not.
13. **Popover under horizontal scroll.** Resize the browser narrow.
    Horizontally scroll the table. Open a `building_zone` popover —
    the popover follows the cell, not the viewport.
14. **Type-checks / lint / tests / build.** Run `make typecheck && make
    lint && make test && pnpm run build` in a separate terminal —
    everything clean.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — registry + WriteOp | — | — | — |
| 2 — typed-draft useGridEdit | — | — | — |
| 3 — SingleSelectPopover | — | — | — |
| 4 — keyboard semantics | — | — | — |
| 5 — aria-live polish | — | — | — |
| 6 — demo walk + fixes | — | — | — |
| Phase 1 overall | — | — | — |

## 12. Open questions (for Ed before Step 1)

These are deliberate forks where the plan picked a default; flag at
review if you want any of them reversed.

1. **Enter-to-edit replaces Enter-to-open-row-modal.** No fallback
   shortcut added in Phase 1. Acceptable, or do you want a row-modal
   shortcut (e.g., Space on a focused row, ⌘E, etc.)? Default: no
   shortcut, modal stays double-click-on-read-only-field only.
2. **Tab boundary bubble.** Default: Tab off the last cell exits the
   grid (AirTable + L5.2 a11y). Alternative: keep Phase 0's wrap.
   Default picked.
3. **`removedOptions` on the `cell` op** vs. a separate
   `fieldDefMutation` op carried as the inverse. Default: extend
   `cell` (one op kind, symmetric forward/inverse). Alternative:
   inverse is a different op kind. Default picked.
4. **Popover library: `@radix-ui/react-popover`** as the answer to the
   parent-plan §15.3 "shadcn Popover" wording. Confirmed by Ed
   2026-05-23. We do not pull the full shadcn CLI scaffold.
5. **Double-Esc clears focus.** Default: yes. Alternative: defer to a
   later phase. Default picked.
