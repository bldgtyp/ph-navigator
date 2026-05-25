---
DATE: 2026-05-24
TIME: planning
STATUS: Walked with Ed 2026-05-24; all ten §12 open questions resolved
        inline. Biggest UX delta vs the original draft: AirTable's
        field editor is a **popover anchored to the column header,
        opened by double-clicking the header** — not a modal opened
        from a `⋯` menu. Ed supplied two reference screenshots saved
        under `research/airtable-screenshots/field-editor-2026-05-24/`
        and asked the implementation to match AirTable as closely
        as possible. The popover surface uses the existing
        `@radix-ui/react-popover` dependency, so **Phase 5 ships
        zero new npm dependencies.** Resolution #10 ("no existing
        users, no existing deploy — remove all out-of-date code and
        API fully") additionally removes the `renderHeaderActions`
        slot entirely (it has no remaining consumer; Phase 6 will
        re-add a slot when the aggregation picker needs one), drops
        the `onSaveOptions` prop verbatim, and deletes
        `RoomOptionManager.tsx` and the consumer-side option
        helpers in one cutover rather than running the old and new
        paths in parallel during Steps 3–5. Ready to begin Step 1.
SCOPE: Phase 5 of the `<DataTable>` AirTable-parity plan. Move the
       single-select option-management UI off the consumer
       (`features/equipment/components/RoomOptionManager.tsx`) and
       into the shared `<DataTable>` library as a library-owned
       **field-editor popover** anchored to the column header,
       opened by **double-clicking the header**, matching AirTable's
       UX (see `research/airtable-screenshots/field-editor-2026-05-24/`).
       Every popover-save gesture (reorder, recolor, rename, add,
       delete, color-code toggle, alphabetize) emits a single
       semantic `WriteOp.kind = "fieldDefMutation"` through the
       existing write reducer so ⌘Z reverts the change as one entry
       (PoC L6.1, L6.2, L6.5). Delete-with-references cascades through
       the SAME op (one op carrying both the option removal and the
       dependent cell writes), per the parent plan §11 and the L6.5
       rule. Driven against Rooms (US-EQ-2). The consumer-side
       `RoomOptionManager`, the `onSaveOptions` prop on `RoomsTable`,
       the `saveOptions` callback in `EquipmentTab`, and the
       `renderHeaderActions` slot on `<DataTable>` are **all
       removed** in the same cutover (resolution #10: no backwards
       compat needed — no existing users, no existing deploy). The
       `saveOptions` branch in `EquipmentTab` is replaced by a
       `fieldDefMutation` branch in the existing `handleTableWrite`.
       Closes US-Builder-Tables criterion 17 (project-defined
       option-list management) and is the **parity gate** for the
       parent plan — after Phase 5, every core AirTable cell / row /
       view / option behavior runs against the primitive.
PARENT-PLAN: docs/plans/2026-05-23/datatable-airtable-parity.md
RELATED:
  - research/airtable-screenshots/field-editor-2026-05-24/
    (Ed's 2026-05-24 reference shots — column header in typical
    state with the field-type icon + hover chevron, and the
    full field-editor popover anchored to the header)
  - context/technical-requirements/data-table.md (canonical contract,
    §Field-Type Registry + §Behavior; option mutation semantics)
  - context/user-stories/30-tables-equipment.md
    (US-Builder-Tables criterion 17 — option editor; criterion 16 —
    duplicate-label guard)
  - docs/plans/2026-05-23/phase-0-foundation-refactor.md
    (write reducer, history, dispatchWrite/inverse contract)
  - docs/plans/2026-05-23/phase-1-inline-edit-popover.md
    (create-on-edit OptionListDelta — Phase 5 expands the same idea
    to whole-popover saves)
  - docs/plans/2026-05-23/phase-4-stacked-filter-sort.md
    (`renderHeaderActions` slot; `data-axis-tint` carrier `<th>`;
    `@dnd-kit/sortable` precedent)
  - research/poc-plans/poc-lessons-for-real-build.md
    (L2.3 typed FieldDef registry, L6.1 single write primitive, L6.2
    semantic undo entries, L6.5 field-def + cell co-op, L10.2 native
    controls)
  - frontend/src/features/equipment/components/RoomOptionManager.tsx
    (the consumer-side component this phase deletes)
  - frontend/src/features/equipment/lib.ts §replaceRoomOptionsPayload,
    §optionReferenceCounts, §missingOptionReferences,
    §normalizeOptionOrders (the helpers Phase 5 either moves into the
    library or replaces with the registry path)
---

# Phase 5 — Single-select field-editor popover (option management)

## 1. Why this phase exists

After Phases 0–4, the `<DataTable>` primitive owns every interaction
mode AirTable ships **except** project-defined option-list management.
Rooms currently routes that flow through `RoomOptionManager`
(`features/equipment/components/RoomOptionManager.tsx`, 221 LOC) — a
consumer-side popover threaded into the table via the `renderHeaderActions`
slot. That arrangement violates the binding constraint from the parent
plan §3.3: **no per-consumer code added in this plan; every change
lands in `shared/ui/data-table/` or shared field-def code.** The
Rooms surface is the only place option editing exists today; the next
consumer that wants single-select fields (Thermal Bridges, ERVs, Pumps,
Fans, and the three catalog pages once the migration plan picks them
up) would have to copy `RoomOptionManager` byte-for-byte and rewire its
own save path.

Concretely, the surface that needs to land in the library:

1. **Trigger — double-click the header.** AirTable opens the field
   editor when the user double-clicks the column header (see image
   01-column-header-typical.png — note the hover chevron `▾`
   beside the field name indicating "this header is editable").
   Phase 5 follows: any `<th>` whose `field_type === "single_select"`
   becomes double-clickable, with a hover-revealed chevron in the
   header label region as the affordance. The library does NOT
   ship a `⋯` overflow menu in Phase 5 (the original draft
   proposed one — resolved against per §12 Q1: matches AirTable
   parity, and removes a click compared to menu-then-popover).
   The `renderHeaderActions` slot is **removed entirely** in this
   phase (resolution #10: no existing consumer, no backwards
   compat needed). Phase 6 re-adds a slot when the aggregation
   picker requires one.
2. **Popover, not modal.** Per resolution #3 and the reference
   screenshot 02-field-editor-popover.png, AirTable surfaces the
   field editor as a Radix-style popover anchored below the
   column header (with a visible tail / arrow up to the header
   label). The popover scrolls internally for long option lists.
   This uses the **existing `@radix-ui/react-popover` dependency**
   already wired for `SingleSelectPopover`, `FilterPopover`,
   `SortPopover`, and `ViewMenuOverflow` — **Phase 5 ships zero
   new npm dependencies.** Delete-with-references still escalates
   to a nested AlertDialog (existing `@radix-ui/react-alert-dialog`)
   because the destructive choice deserves its own focused
   surface (matches Phase 2's row-delete-confirm pattern).
3. **One semantic op per save.** The current consumer-side
   `RoomOptionManager` calls `onSaveOptions(fieldKey, options,
   replacements?)` directly, bypassing the `<DataTable>` write
   reducer entirely. As a result, **option-list edits today produce
   no undo entry, and a ⌘Z after a recolor / rename / reorder is a
   no-op.** Phase 5 routes every save through `dispatchWrite` with
   forward + inverse `WriteOp.kind = "fieldDefMutation"` ops, so the
   undo stack carries option-list mutations alongside cell / row
   mutations (PoC L6.1, L6.2). Delete-with-references emits one op
   containing both the field-def diff and the cascading cell writes
   (PoC L6.5; matches the cell-popover create flow from Phase 1).
4. **Consumer cleanup — full cutover.** With the library owning
   the trigger, the popover, the save semantics, and the undo
   entry, the consumer (a) deletes `RoomOptionManager.tsx`;
   (b) drops the `onSaveOptions` prop on `RoomsTable`;
   (c) deletes the per-column `renderHeaderActions` block in
   `RoomsTable.tsx` and the `renderHeaderActions` prop from
   `DataTable` itself (resolution #10 — the slot has no
   remaining consumer; Phase 6 will re-introduce a slot in
   whatever shape its aggregation picker needs); (d) replaces
   `EquipmentTab.saveOptions` with a `fieldDefMutation` branch in
   `handleTableWrite`. The existing backend path
   (`replaceRoomOptionsPayload`) does not change — only its
   **call site** moves. There is **no parallel-run window** where
   both the old and new paths exist (the original draft proposed
   one for Steps 3–4; resolution #10 collapses that into a single
   Step-5 cutover). The consumer is now thin enough to disappear
   into a single `handleTableWrite` switch statement.

This phase is the **parity gate** the parent plan §17 calls out
(`Phase 5 is the natural parity gate against Rooms — after it lands,
all core AirTable behaviors run against the primitive`). Once it ships,
Phases 6 (group accordion + tint cascade) and 7 (fill handle + ⌘D / ⌘R)
are visual / ergonomic polish, and the catalog page migration (§14)
can begin against a primitive that no longer demands consumer-side
plumbing for any AirTable behavior.

## 2. Binding constraints

1. **Library-only.** All new components, hooks, and helpers land in
   `frontend/src/shared/ui/data-table/`. The consumer touch list is
   strictly destructive (delete + simplify) — three files only:
   `RoomOptionManager.tsx` (deleted), `RoomsTable.tsx` (props
   simplified, header-actions block removed), `EquipmentTab.tsx`
   (`saveOptions` replaced by a switch branch in `handleTableWrite`).
   `features/equipment/lib.ts` loses three exports that move to the
   library (`optionReferenceCounts`, `missingOptionReferences`,
   `normalizeOptionOrders`); the existing `replaceRoomOptionsPayload`
   stays put — it's the backend-shape function that translates a
   `fieldDefMutation` op into a `RoomsReplacePayload`, and that
   translation is consumer-specific.
2. **`onWrite` is the only mutation channel for field-def changes.**
   Every save (reorder, recolor, rename, add, delete, delete-with-
   cascade) calls `dispatchWrite(forward, inverse)` exactly once.
   No per-axis callback. No `onSaveOptions` prop. Read-only mode
   (`readOnly={true}`) hides the menu trigger entirely — the
   primitive's existing read-only contract (Phase 2 §4.5 + Phase 4
   §4.4 constraint 10) puts mutations behind `onWrite`'s presence;
   Phase 5 follows.
3. **One semantic op per popover save** (L6.2). The forward op carries
   the complete `after` FieldDef and (when delete cascades) the full
   `cellWrites` array. The inverse op carries the complete `before`
   FieldDef and the inverse `cellWrites` (each cell's pre-delete
   value). ⌘Z restores the field def AND the affected cells in a
   single user gesture.
4. **Field-def + cell writes ride in the same op** (L6.5). The
   existing `WriteOp.kind = "fieldDefMutation"` union member
   (`types.ts:153`) currently carries only `{ before, after }`.
   Phase 5 widens it to carry an optional `cellWrites?: CellWrite[]`
   for the delete-with-cascade case. Strict superset — there are
   **zero in-repo dispatchers** of `fieldDefMutation` today
   (verified by grep), so the widening is non-breaking for every
   call site.
5. **Popover anchored to the header, not a modal** (resolution #3,
   per AirTable parity). The trigger opens an
   `@radix-ui/react-popover` content surface anchored below the
   column header with a visible arrow / tail pointing up. The
   popover scrolls internally for long option lists (a 12+ option
   `floor_level` list scrolls within the popover rather than the
   page). The delete-with-impact confirm escalates to a **nested
   AlertDialog** (Radix supports nested overlays) — destructive
   choice stays visually distinct from the editing surface,
   matching Phase 2's confirm-dialog pattern.
6. **Zero new dependencies** (resolution #3). The popover surface
   uses the existing `@radix-ui/react-popover` already wired for
   `SingleSelectPopover`, `FilterPopover`, `SortPopover`, and
   `ViewMenuOverflow`. The confirm sub-dialog uses the existing
   `@radix-ui/react-alert-dialog` wired for `ConfirmRowDeleteDialog`.
   `@dnd-kit/sortable` (added in Phase 4) is reused for option
   reorder — no second drag library, no `@radix-ui/react-dialog`
   add.
7. **Rename is non-destructive.** Rows store `option_id` (Phase 1
   contract); cell render pulls the current `label` via
   `singleSelectOption(value, fieldDef)`. A rename modifies only
   `FieldDef.options[i].label`; **no cell writes ride along**.
   Verified against the existing Rooms data path — `roomsSlice.rooms`
   carries `floor_level: string | null` (option id), not the label.
   Reorder is also non-destructive (modifies `options[i].order`, no
   cell writes). Recolor is non-destructive (modifies
   `options[i].color`, no cell writes).
8. **Delete is destructive only when references exist.** When the
   user deletes an option that no row references, the op is
   `fieldDefMutation` with the option spliced out of
   `after.options`, no `cellWrites`. When ≥1 row references the
   option, the user picks one of two cascade modes — **Clear** (set
   referencing cells to `null`) or **Replace with…** (set
   referencing cells to a different option id) — and the op carries
   the `cellWrites` array describing every affected cell.
9. **Required fields cannot be cleared.** When `FieldDef.required ===
   true` and the user picks Delete on an option with references, the
   "Clear" cascade mode is disabled and the sub-dialog forces a "Replace
   with…" pick. This matches the existing
   `RoomOptionManager.mustMergeDelete` rule (`RoomOptionManager.tsx:52`)
   and `replaceRoomOptionsPayload`'s thrown error when a referenced
   option is removed without a replacement (`lib.ts:251`).
10. **Duplicate-label guard.** Save is blocked if any two options
    share a trim+lowercase label. Uses the existing
    `hasDuplicateFieldOptionLabels` helper (`data-table/lib.ts:485`)
    so the rule is library-internal and the consumer doesn't need to
    re-validate.
11. **Read-only stays read-only.** With `readOnly={true}` or
    `onWrite={undefined}`, the column header's double-click handler
    is not bound and the hover chevron does not render (Viewer mode
    + locked-version mode disable the trigger entirely — there's no
    "disabled" state to wrestle with). This matches the
    consumer-side `disabled={!isEditor}` rule in today's
    `RoomOptionManager`.
12. **Color palette = the existing 6-color list** in
    `data-table/lib.ts:510`. Phase 5 exports it as
    `OPTION_COLOR_PALETTE` so the recolor swatch picker iterates the
    same source the `createFieldOption` flow already uses. Phase 6
    expands to a 14-entry pre-mixed tint palette per parent plan
    §12 (L9.2). Phase 5 does NOT touch the palette content.
13. **Tests live with the primitive.** New coverage in
    `__tests__/FieldEditorPopover.test.tsx`,
    `__tests__/columnHeaderDoubleClick.test.tsx`,
    `__tests__/optionReferences.test.ts`, plus extensions in
    `DataTable.test.tsx` and `useGridWriteReducer.test.ts` for the
    widened `fieldDefMutation` op shape. The consumer integration
    tests in `EquipmentTab.test.tsx` and
    `App.test.tsx` (whatever rooms-option-flow ones exist) get
    a mechanical rewrite: the "Options" button (today's
    `RoomOptionManager.tsx:65`) no longer exists; tests now drive
    the popover via a synthetic double-click on the column header
    `<th>`. Save-time payload shape stays identical because
    `replaceRoomOptionsPayload` is unchanged.

## 3. Acceptance criteria

"Phase 5 demo passed" means all sixteen are true on a real browser
walk against Rooms.

1. **Hover chevron renders for single_select fields only.**
   On a Rooms grid: hovering the `floor_level` or `building_zone`
   header reveals a small chevron `▾` next to the label and the
   cursor changes to `pointer`. Hovering `number`, `name`,
   `num_people`, `num_bedrooms`, `icfa_factor`, `erv_unit_ids`
   (text / number / computed / read-only) shows no chevron and
   the cursor stays default.
2. **Double-click the header opens the popover.** Double-click
   `floor_level`. A Radix popover opens, anchored below the
   header with a visible arrow / tail pointing up. The first
   focusable element receives focus (the first option's label
   `<input>`, see §4.3).
3. **Popover lists current options in `order`.** Floor-level
   options render as a vertical list, ordered by `option.order`
   ascending. Each row shows: drag handle (`⋮⋮`), color circle
   with chevron (sub-popover trigger), label `<input>`, delete
   `×`. A reference-count chip (`N rows`) sits to the right of
   the label when the option is referenced.
4. **Reorder via drag.** Drag the second row above the first.
   `view.filter`/`view.sort` are unaffected (option ordering is a
   field-def property, not a view-state property). On Save, the
   grid re-sorts any sort rule that ordered by `floor_level`
   (single-select sort uses option order; see `lib.ts:sortRows`).
4a. **Alphabetize button.** Clicking the `↕ Alphabetize` button
    in the Options section header sorts the draft option list
    case-insensitively A→Z. This is a draft-only mutation
    (`Cancel` discards it); Save commits the new order via the
    same `fieldDefMutation` op.
4b. **Color-code options toggle.** The `Color-code options`
    toggle in the Options section header defaults to on.
    Switching it off renders every pill as a uniform neutral
    background (no `--option-color` applied) — the per-option
    color slots stay populated in the field def but the renderer
    skips them. Saving with the toggle off persists the choice
    on a new `FieldDef.colorCodeOptions: boolean` slot (see §4.4).
5. **Recolor via color-circle sub-popover.** Click the color
   circle on a row → a small Popover opens with the 6 palette
   swatches in a 3×2 grid. Click the purple swatch → the row's
   color updates live in the editor. Save closes the popover;
   the grid's pill colors update across every row referencing
   that option.
6. **Rename in-place.** Type `First Floor` over `1st` in the
   label input. Save. Every row's `floor_level` pill reads
   `First Floor` and renders with its current color. The
   downloaded `rooms.json` (Phase 4 demo step 19's path) shows
   `floor_level` cells still carry the same `opt_first` ids —
   confirming the rename is non-destructive.
7. **Add option.** Click `+ Add option` footer. A new row appears
   at the bottom with empty label, next-palette color, focus on
   the label input. Type `Mezzanine`, Tab out, Save. The option
   is appended to `view`'s field def; cell-popover editors and
   the rendered pills surface it immediately.
8. **Delete option with no references.** Right-click delete the
   newly-added "Mezzanine" (no rows reference it). The row
   disappears from the popover without prompting. Save commits a
   `fieldDefMutation` with `after.options` lacking the entry, no
   `cellWrites`.
9. **Delete option with references — "Clear" path.** Floor `Roof`
   is referenced by 2 rooms. Click delete on `Roof`. A nested
   confirm sub-dialog opens: *"2 rows reference 'Roof'. Choose
   what to do."* Pick **Clear referenced cells** → Confirm. The
   sub-dialog closes. The popover now lists the remaining
   options without `Roof`. Save dispatches one
   `fieldDefMutation` op with `after.options` lacking `Roof` AND
   `cellWrites: [{rowId: rm_..., fieldKey: "floor_level", value:
   null}, {...}]`. The grid renders both affected rooms with the
   "Unassigned" muted-cell style.
10. **Delete option with references — "Replace with…" path.**
    Restore via ⌘Z (criterion 12). Re-open the popover, delete
    `Roof` again, but pick **Replace with: Attic** → Confirm.
    Save dispatches one op with `after.options` lacking `Roof`
    AND `cellWrites` setting the two rows' `floor_level` to
    `opt_attic`. The grid renders both rows with the `Attic` pill.
11. **Required-field clamp.** `floor_level` is required
    (`required: true` in the Rooms field defs). On the delete
    sub-dialog for an option with references, the "Clear" radio
    is **disabled** and a help line reads *"Floor is required —
    pick a replacement option."* Confirm is disabled until a
    replacement is picked. Unmute the field (a future test
    convenience — out of scope for the demo) does the inverse.
12. **⌘Z reverts the whole save in one entry.** After criterion
    9 (delete with Clear cascade), ⌘Z restores both the `Roof`
    option AND the two cells' previous values in a single undo.
    ⌘⇧Z redoes the whole gesture.
13. **Duplicate-label guard blocks Save.** Rename `Ground` to
    `1st` (a duplicate of an existing option's label) — the
    Save button disables and an inline `Option labels must be
    unique` warning appears below the list. Restoring the label
    re-enables Save.
14. **Read-only mode disables the trigger.** Sign in as Viewer or
    open a locked version. Hovering a single-select header shows
    no chevron and double-clicking is a no-op (the handler is
    unbound). The toolbar Filter / Sort popovers from Phase 4
    still open and edit; only mutations (option edit, inline
    edit, paste, delete-N) stay blocked.
15. **No Phase 0 / 1 / 2 / 3 / 4 regressions.** All 247
    existing tests pass. Inline edit (Phase 1) still creates
    on-the-fly options through the cell popover and emits the
    `cell` op with `newOptions` (existing Phase 1 path —
    unaffected by Phase 5's whole-popover flow). Filter / sort
    popovers (Phase 4) still open and edit. Row insert / delete,
    mouse drag, ⌘C / ⌘V, autoscroll, perimeter outline, axis
    tints all work as before. The Rooms `RoomModal` (the
    consumer's standalone row-edit modal) opens via Enter / row
    double-click as it did pre-Phase-5 — Phase 5 does not touch
    it.
16. **`make typecheck && make lint && make test && make format`**
    and **`pnpm run build`** all clean. `pnpm run dev` walks §10
    end-to-end in Chrome and Safari without console errors.

## 4. Target architecture

### 4.1 File layout (after)

```
frontend/src/shared/ui/data-table/
  DataTable.tsx              composes the column-header double-click
                             handler and the FieldEditorPopover;
                             threads dispatchWrite/inverse so saves
                             flow through the existing reducer.
                             Adds one new piece of internal state —
                             the "field-editor-open-for-fieldKey"
                             string-or-null — and one effect that
                             closes the popover on rows-identity /
                             fieldDefs-identity change. Removes the
                             `renderHeaderActions` prop pass-through.
                             Stays ≤ ~300 LOC.
  components/
    GridHeader.tsx           extended — binds an `onDoubleClick`
                             handler to each `<th>` whose
                             `field_type === "single_select"`,
                             `readOnly === false`, and `onWrite`
                             is set. Renders a hover-revealed `▾`
                             chevron next to the header label as
                             the affordance. Removes the
                             `renderHeaderActions` slot entirely.
    FieldEditorPopover.tsx   NEW — the Radix Popover content
                             anchored to the column header. Owns:
                             draft-options state, drag-and-drop
                             reorder via `@dnd-kit/sortable`, the
                             "Color-code options" toggle, the
                             "Alphabetize" button, label inputs,
                             color-circle sub-popovers, reference-
                             count chips, per-row delete buttons,
                             the +Add option entry, the Save /
                             Cancel footer, and the nested
                             ConfirmDeleteOption AlertDialog.
                             Composes dispatchWrite/inverse from
                             props; owns no business logic beyond
                             draft state and validation.
    ConfirmDeleteOptionDialog.tsx
                             NEW — nested Radix AlertDialog (same
                             primitive as ConfirmRowDeleteDialog).
                             Shows reference count + cascade-mode
                             radios (Clear / Replace with… /
                             Cancel). Returns a CascadeChoice via
                             onConfirm; the parent
                             FieldEditorPopover stages the change
                             into its draft state.
    GridBody.tsx             UNCHANGED
    GridGutter.tsx           UNCHANGED
    GridToolbar.tsx          UNCHANGED
    FilterPopover.tsx        UNCHANGED
    SortPopover.tsx          UNCHANGED
    ViewMenuOverflow.tsx     UNCHANGED
    ConfirmRowDeleteDialog.tsx
                             UNCHANGED
    InlineCellEditor.tsx     UNCHANGED
    SingleSelectPopover.tsx  UNCHANGED
  hooks/
    useGridSelection.ts      UNCHANGED
    useGridRowSelection.ts   UNCHANGED
    useGridPointerDrag.ts    UNCHANGED
    useGridKeyboard.ts       UNCHANGED
    useGridEdit.ts           UNCHANGED
    useGridHistory.ts        UNCHANGED
    useGridWriteReducer.ts   UNCHANGED (the widened
                             `fieldDefMutation` op rides the same
                             dispatch path; the reducer does not
                             switch on op.kind)
    useGridClipboard.ts      UNCHANGED
  fields/
    registry.ts              UNCHANGED
    types.ts                 UNCHANGED
    filterOperators.ts       UNCHANGED
  lib.ts                     extended — exports
                             `OPTION_COLOR_PALETTE: readonly
                             string[]` (the existing 6-color list,
                             promoted from the private
                             `nextOptionColor` helper), and three
                             new pure helpers moved from
                             `features/equipment/lib.ts`:
                             `optionReferenceCounts(rows, fieldKey,
                             accessor)`,
                             `missingOptionReferences(rows,
                             fieldKey, options, accessor)`,
                             `normalizeOptionOrders(options)`. The
                             accessor parameter makes the helpers
                             row-shape-agnostic so any consumer can
                             reuse them.
  types.ts                   `WriteOp.kind = "fieldDefMutation"`
                             widened — see §4.4. `FieldDef` adds
                             an optional `colorCodeOptions?:
                             boolean` slot (defaults true; only
                             meaningful for single_select). The
                             `renderHeaderActions` prop on
                             `DataTableProps` is **removed**.
  index.ts                   exports `OPTION_COLOR_PALETTE` plus the
                             three new helpers above; the
                             FieldEditorPopover itself stays
                             internal (no external consumer reaches
                             into it). The `renderHeaderActions`
                             type export is removed.
  __tests__/                 existing tests preserved; new tests
                             added (see §4.11).
```

Consumer touch list (destructive only):

```
frontend/src/features/equipment/
  components/
    RoomOptionManager.tsx                  DELETED (221 LOC removed)
    RoomsTable.tsx                         renderHeaderActions block
                                           and onSaveOptions prop
                                           removed (-25 LOC); the
                                           component shrinks to a
                                           thin DataTable wrapper.
  lib.ts                                   `optionReferenceCounts`,
                                           `missingOptionReferences`,
                                           `normalizeOptionOrders`
                                           moved into the library
                                           (deleted here, re-imported
                                           from
                                           `shared/ui/data-table`).
                                           `replaceRoomOptionsPayload`
                                           stays.
  routes/EquipmentTab.tsx                  `saveOptions` callback
                                           removed; handleTableWrite
                                           gains a `fieldDefMutation`
                                           branch that translates
                                           `op.after.options` +
                                           `op.cellWrites` into a
                                           single
                                           `replaceRoomOptionsPayload`
                                           call. (-20 LOC, +25 LOC.)
  lib.test.ts                              the three moved helpers'
                                           tests relocate to
                                           `data-table/__tests__/
                                           optionReferences.test.ts`.
                                           `replaceRoomOptionsPayload`
                                           tests stay.
```

`App.css` adds rules for the field-editor popover surface (reuses
the existing `.data-table-view-popover` token from Phase 4 as a
base + adds an `.is-field-editor` modifier for the wider
min-width and the section dividers), the header hover chevron
and `data-field-editable` cursor (per §4.2), the Options-section
header row holding the Color-code toggle + Alphabetize button,
the option-row grid layout (drag handle · color circle · label
input · reference chip · delete), the color sub-popover surface
(6 swatches in a 3×2 grid), the `⊕ Add option` entry, and the
nested delete-confirm AlertDialog (re-uses Phase 2's
`.data-table-alert-overlay` / `.data-table-alert-content`). The
existing `.single-select-pill` styling is reused verbatim for the
in-popover color circle preview.

### 4.2 Column header trigger (double-click)

AirTable opens the field editor when the user double-clicks the
column header (see `research/airtable-screenshots/
field-editor-2026-05-24/01-column-header-typical.png`). The
affordance is a hover-revealed `▾` chevron in the header label
row indicating the field is editable; the cursor also switches to
`pointer` on hover.

Markup additions to `GridHeader.tsx`:

```tsx
const isEditableSingleSelect =
  fieldDef.field_type === "single_select" &&
  !readOnly &&
  hasWriteHandler;

<th
  role="columnheader"
  aria-colindex={columnIndex + 1}
  data-axis-tint={axisTint ?? undefined}
  data-field-editable={isEditableSingleSelect ? "true" : undefined}
  className={["data-table-th", columnIndex === 0 ? "data-table-frozen" : ""]
    .filter(Boolean)
    .join(" ")}
  onMouseDown={
    column && onColumnMouseDown
      ? (event) => onColumnMouseDown(event, column.fieldKey)
      : undefined
  }
  onDoubleClick={
    isEditableSingleSelect
      ? (event) => {
          event.preventDefault();
          event.stopPropagation();
          onEditField(column.fieldKey);
        }
      : undefined
  }
>
  <div className="data-table-header-row">
    <span className="data-table-header-label">
      {flexRender(header.column.columnDef.header, header.getContext())}
    </span>
    {isEditableSingleSelect ? (
      <span aria-hidden className="data-table-header-edit-chevron">▾</span>
    ) : null}
  </div>
</th>
```

CSS (hover-reveal chevron, pointer cursor, "open" state stays
revealed):

```css
.data-table-th[data-field-editable="true"] {
  cursor: pointer;
}
.data-table-header-edit-chevron {
  opacity: 0;
  font-size: 10px;
  color: var(--muted);
  transition: opacity 0.1s ease-out;
  margin-left: 4px;
}
.data-table-th[data-field-editable="true"]:hover
  .data-table-header-edit-chevron,
.data-table-th[data-field-editor-open="true"]
  .data-table-header-edit-chevron {
  opacity: 1;
}
```

The `data-field-editor-open` attribute is set on the `<th>` while
the popover is open so the chevron stays revealed when the cursor
moves off the header into the popover content.

**Pointer-event coordination with Phase 3's column-select.** The
top 6 px of every `<th>` is the column-select strip (Phase 3 R1
resolution — full-width `<th>` mousedown). Mousedown still triggers
the column-select gesture; double-click is a separate event that
fires after a successful select. To avoid the second mousedown of
the double-click extending an existing column-select range, the
`onMouseDown` path checks `event.detail === 2` and short-circuits
(no range mutation) when a double-click is in progress. Added as
a small change inside `useGridPointerDrag.onColumnMouseDown`; see
Step 2 of §5.

**Why not a `⋯` menu (resolution #1 / #3).** AirTable's
double-click-to-edit gesture is the simpler affordance: one
gesture, one surface, no intermediate menu. The library does
**not** ship a column-overflow `⋯` menu in Phase 5. Phase 6 may
introduce one if the aggregation-picker scope warrants it — that
decision lives in Phase 6's plan, not this one.

**Why keep header-click clean (no single-click).** Single-click
on a header is reserved for the Phase 3 column-select gesture.
Double-click is a different event that doesn't conflict with
single-click consumers. Triple-click and beyond are out of scope
(no in-repo handler).

### 4.3 FieldEditorPopover layout

The popover is a Radix Popover anchored to the column header
`<th>`, with `side="bottom"` and `align="start"`. Layout matches
AirTable's field editor (see
`research/airtable-screenshots/field-editor-2026-05-24/
02-field-editor-popover.png`), restricted to the option-management
subset of AirTable's surface:

```
                            ▲ (popover tail)
┌──────────────────────────────────────────────┐
│  Floor                                       │ ← read-only field name (header)
│                                              │
│  Options                                     │
│  ─ Color-code options [●━━]    ↕ Alphabetize │ ← toggle + sort button
│                                              │
│  ⋮⋮  ⊙▾  [Ground       ]  3 rows         ×  │
│  ⋮⋮  ⊙▾  [1st          ]  2 rows         ×  │
│  ⋮⋮  ⊙▾  [2nd          ]  1 row          ×  │
│  ⋮⋮  ⊙▾  [Roof         ]  2 rows         ×  │
│                                              │
│  ⊕ Add option                                │
│                                              │
│  Option labels must be unique.               │ ← validation surface (when active)
│                                              │
│  ────────────────────────────────────        │
│                       [ Cancel ] [  Save  ]  │ ← footer
└──────────────────────────────────────────────┘
```

**What Phase 5 deliberately omits from AirTable's popover** (to
keep scope tight; see §7):

- Field-name `<input>` (top of AirTable's popover) — Phase 5 shows
  the field name as a read-only `<h3>`-style heading. Renaming
  the `display_name` is a consumer-controlled property today;
  promoting it to user-editable is a future-phase concern.
- Field-type dropdown ("Single select" picker) — Phase 5 only
  edits single_select fields and does not allow type changes.
- Description text input and "+ Add description" link — defer.
- Default-option picker — defer (`FieldDef.default` exists as a
  slot today and is consumer-populated; user-driven default
  editing is a future-phase concern).
- "Convert" / "Automate this field with an agent" — AirTable AI;
  out of scope.

What Phase 5 ships from AirTable's popover:

- **Color-code options toggle** — wraps the option list; when
  off, every pill renders with a neutral background (the
  per-option color is preserved in the field def but the
  renderer's `color` style is suppressed). Persisted on a new
  optional `FieldDef.colorCodeOptions?: boolean` slot. Default
  true.
- **Alphabetize button** (`↕ Alphabetize`) — single-click sort
  the draft options A→Z (case-insensitive, locale-aware). Draft
  mutation only; commits via Save.
- **Per-option row** with `⋮⋮` drag handle, color circle (`⊙`)
  with sub-popover chevron, label `<input>`, reference-count
  chip, delete `×` — matches AirTable's row layout.
- **`⊕ Add option`** entry at the end of the option list (matches
  AirTable's plus-icon affordance).

Per-row chrome:

- **Drag handle** (`⋮⋮`) — `@dnd-kit/sortable` listener. Pointer
  drag reorders within the local draft state. Keyboard: Space
  picks up, arrow keys reorder, Space drops (dnd-kit default).
  Hover-visible per Phase 4 precedent.
- **Color circle** (`⊙▾`) — a small circular button rendered
  with `background: var(--option-color)` (the same `--option-color`
  CSS var the existing `.single-select-pill` uses). The trailing
  `▾` indicates it's a sub-popover trigger. Clicking opens a
  sibling Radix Popover with the 6 palette swatches as buttons
  in a 3×2 grid; clicking a swatch sets the draft option's color
  and closes the sub-popover.
- **Label `<input>`** — borderless text input bound to
  `draftOption.label`. Validation runs on every keystroke; the
  duplicate-label guard is computed across the whole draft list
  via `hasDuplicateFieldOptionLabels`.
- **Reference-count chip** — `N row` / `N rows` (uses
  `optionReferenceCounts(rows, fieldKey, accessor)` — see §4.6).
  Hidden when the count is 0.
- **Delete (×)** — a destructive button. If the option has 0
  references, the row is removed from the draft immediately (no
  confirm). If ≥1 references, opens the nested
  `ConfirmDeleteOptionDialog` (§4.5).
- **⊕ Add option** — footer entry. Appends a draft option with
  empty label and `OPTION_COLOR_PALETTE[draftOptions.length %
  PALETTE.length]` as color, focuses its label input. New
  options are unsaved until Save is clicked.
- **Cancel** — closes the popover without dispatching (silently
  discards the draft per resolution #5). Esc and click-outside
  behave the same.
- **Save** — disabled when (a) any draft label is empty,
  (b) `hasDuplicateFieldOptionLabels(draft)` is true, or (c) the
  draft is identical to the original (no-op save). On click:
  compute the diff vs `fieldDef.options` (and the
  `colorCodeOptions` slot), build the `fieldDefMutation` op +
  its inverse, dispatch through `dispatchWrite`, close the
  popover.

The popover is anchored via `Popover.Anchor` to the column header
`<th>`, so horizontal scrolling and column-width changes keep it
visually attached. Focus returns to the header `<th>` on close
(handled by Radix's `onCloseAutoFocus`).

### 4.4 `WriteOp.kind = "fieldDefMutation"` widening

```ts
// types.ts — diff

export type WriteOp =
  | ({ kind: "cell"; writes: CellWrite[] } & OptionListDelta)
  | ({
      kind: "paste";
      writes: CellWrite[];
      rowsInserted: unknown[];
      newOptions: Record<string, FieldOption[]>;
    } & Pick<OptionListDelta, "removedOptions">)
  | { kind: "fill"; writes: CellWrite[] }
  | { kind: "rowInsert"; rows: RowInsertPayload[] }
  | { kind: "rowDelete"; rows: RowDeletePayload[] }
  | {
      kind: "fieldDefMutation";
      before: FieldDef;
      after: FieldDef;
      // Optional dependent cell writes that ride in the same op so
      // ⌘Z reverts the field-def + cell changes together (PoC L6.5).
      // Populated when a delete-with-references cascade runs in
      // Clear or Replace-with mode. Empty / omitted for pure
      // reorder / recolor / rename / add saves.
      cellWrites?: CellWrite[];
    };
```

The widening is a **strict superset**. The existing `before` /
`after` discriminator survives byte-identically; consumers that
never read `cellWrites` continue to compile. The only in-repo
producer of `fieldDefMutation` after Phase 5 is the new
`FieldEditorPopover`; the only in-repo consumer is the new
`EquipmentTab.handleTableWrite` branch (and any test that builds
a synthetic op).

`FieldDef` also grows an optional `colorCodeOptions?: boolean`
slot:

```ts
export type FieldDef = {
  field_key: string;
  field_type: FieldType;
  display_name: string;
  read_only?: boolean;
  required?: boolean;
  description?: string;
  options?: FieldOption[];
  default?: unknown;
  computed_type?: "text" | "number";
  // Phase 5: when false, single_select pills render with a
  // neutral background even when each option still carries a
  // color. Default true (matches Phase 1–4 behaviour). Only
  // meaningful for `field_type === "single_select"`.
  colorCodeOptions?: boolean;
};
```

Cell renderers (`singleSelectOption` callers and pill components)
read the slot and skip the `--option-color` CSS var when the slot
is explicitly false. A `fieldDefMutation` op that toggles the
slot carries no `cellWrites` (it's a presentational property
only, no row-data dependency).

Diff vs. the cell-popover Phase 1 `cell` + `OptionListDelta`
pattern: those carry option-list deltas because the user gesture is
fundamentally a cell write, with an inline option-create as a side
effect. Phase 5's gesture is fundamentally a field-def write, with
dependent cell clears as a side effect — different primary
discriminator, so a different op kind is correct. The two paths
remain distinct: inline-create-during-cell-edit stays a `cell` op,
and modal-driven option-list changes stay a `fieldDefMutation`. The
consumer-side `handleTableWrite` switch dispatches each to the
right backend payload builder.

### 4.5 ConfirmDeleteOptionDialog

A Radix AlertDialog rendered as a sibling of the FieldEditorPopover
content (Radix supports nested overlays — the AlertDialog renders
above the popover via its own Portal). Composition:

```
┌────────────────────────────────────────────────────────────┐
│  Delete option "Roof"?                                     │
│                                                            │
│  2 rows currently reference this option. Choose how to     │
│  handle them:                                              │
│                                                            │
│  ( ) Clear referenced cells                                │
│      Set "floor_level" to empty on the 2 rows.             │
│                                                            │
│  (•) Replace with: [ Ground ▾ ]                            │
│      Set "floor_level" to the picked option on the 2 rows. │
│                                                            │
│                                  [ Cancel ] [ Delete ]     │
└────────────────────────────────────────────────────────────┘
```

- The two radio buttons are mutually exclusive. The "Clear" option
  is **disabled** when `fieldDef.required === true` and a help line
  reads *"\<display_name\> is required — pick a replacement
  option."* (constraint 9, criterion 11).
- The Replace-with picker lists every **other** draft option (i.e.
  every option in the draft list except the one being deleted).
  Default picks the first such option when required-clamp forces a
  replacement; otherwise the default is the "Clear" radio.
- Delete is disabled when the required-clamp forces a replacement
  AND no replacement is picked yet.
- Cancel closes the sub-dialog and returns focus to the row's
  delete button in the popover. The option stays in the draft
  list.
- Confirm closes the sub-dialog and **stages** the cascade into
  the parent popover's draft state: the option is removed from
  `draftOptions`, and a sidecar `stagedCellCascades: Record<rowId,
  newValue>` map accumulates the replacement decisions. The
  popover's Save then builds the `cellWrites` array from the
  cascade map, attaches it to the `fieldDefMutation` op, and
  dispatches.
- A user can also Save the popover with 0 cell cascades (when every
  deleted option had 0 references) — in that case `cellWrites` is
  omitted from the op.

Why a sub-dialog rather than inline-confirm-in-the-row: keeps the
destructive prompt visually distinct, matches Phase 2's
ConfirmRowDeleteDialog pattern, and the "Clear / Replace with"
choice deserves its own focused surface (per US-Builder-Tables
criterion 10 about no-name-retyping — the user shouldn't have to
re-read the option's label inline; a dedicated AlertDialog with
the label in its title is clearer).

### 4.6 Helpers moved into the library

```ts
// data-table/lib.ts — additions

export const OPTION_COLOR_PALETTE: readonly string[] = [
  "#3b82f6",
  "#10b981",
  "#a16207",
  "#7c3aed",
  "#0f766e",
  "#be123c",
] as const;

// Renames internal `nextOptionColor` to reference the palette; the
// existing createFieldOption helper picks colors via
// OPTION_COLOR_PALETTE[length % PALETTE.length]. Existing behavior
// preserved.

// Counts how many rows reference each option id for the given
// fieldKey. The accessor parameter makes this row-shape-agnostic so
// any DataTable consumer can reuse it. (The consumer-side
// optionReferenceCounts(rooms, key) in features/equipment/lib.ts is
// deleted; callers move to this generic helper.)
export function optionReferenceCounts<TRow>(
  rows: readonly TRow[],
  fieldKey: string,
  accessor: (row: TRow) => unknown,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = accessor(row);
    if (typeof value !== "string" || !value) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

// Returns the option ids referenced by ≥1 row that are NOT present
// in the supplied options list. Used by the FieldEditorPopover to
// surface a "N rows reference unknown options" warning (carried
// over from RoomOptionManager's missing-reference indicator).
export function missingOptionReferences<TRow>(
  rows: readonly TRow[],
  fieldKey: string,
  options: readonly FieldOption[],
  accessor: (row: TRow) => unknown,
): string[] {
  const validIds = new Set(options.map((option) => option.id));
  const missing = new Set<string>();
  for (const row of rows) {
    const value = accessor(row);
    if (typeof value !== "string" || !value) continue;
    if (!validIds.has(value)) missing.add(value);
  }
  return [...missing];
}

// Reindexes options' `order` to 0..N-1 in current array order and
// trims their labels. Used after every drag-reorder save to keep
// the order ints contiguous.
export function normalizeOptionOrders(
  options: readonly FieldOption[],
): FieldOption[] {
  return options.map((option, index) => ({
    ...option,
    label: option.label.trim(),
    order: index,
  }));
}
```

The accessor parameter is the row-shape-agnostic seam — the
FieldEditorPopover already has `DataTableColumnDef<TRow>` in
scope, which carries `accessor: (row: TRow) => unknown`, so the
popover can pass `column.accessor` directly. For the Rooms consumer
specifically, this resolves at call time to `(room) => room.floor_level`
or `(room) => room.building_zone` — the same accessors the
existing `RoomsTable` already passes through `columnDefs`.

### 4.7 Save-time op construction

Inside `FieldEditorPopover`, the Save handler:

```ts
async function onSave() {
  const before: FieldDef = fieldDef;             // captured at open time
  const after: FieldDef = {
    ...fieldDef,
    options: normalizeOptionOrders(draftOptions),
  };

  // Build cellWrites from the cascade map. Each entry is one
  // affected row from the delete-with-references flow.
  const cellWrites: CellWrite[] = Object.entries(stagedCellCascades).map(
    ([rowId, newValue]) => ({
      rowId,
      fieldKey: fieldDef.field_key,
      value: newValue,                          // null | string (option id)
    }),
  );
  const inverseCellWrites: CellWrite[] = cellWrites.map((write) => {
    const row = rowsByRowId.get(write.rowId);
    return {
      rowId: write.rowId,
      fieldKey: write.fieldKey,
      // Original (pre-delete) value, captured from the row at
      // popover-open time. Stored on the popover's stagedCellCascades
      // sibling map to keep the inverse lossless.
      value: originalCellValueByRowId[write.rowId] ?? null,
    };
  });

  const forward: WriteOp = {
    kind: "fieldDefMutation",
    before,
    after,
    ...(cellWrites.length > 0 ? { cellWrites } : {}),
  };
  const inverse: WriteOp = {
    kind: "fieldDefMutation",
    before: after,
    after: before,
    ...(inverseCellWrites.length > 0 ? { cellWrites: inverseCellWrites } : {}),
  };

  try {
    await dispatchWrite(forward, inverse);
    onClose();
  } catch (error) {
    setSaveError(error instanceof Error ? error.message : "Save failed.");
  }
}
```

The cascade map is built incrementally inside the popover (each
sub-dialog Confirm calls `stageCascade({...})`) and reset on
popover close. The inverse cell writes use the **original** cell
values captured at popover-open time so the undo path restores
the pre-delete state byte-identically, even if the user has
chained multiple delete + replace decisions before Save.

The forward op also carries the `colorCodeOptions` toggle on
`after`; the inverse swaps `before`/`after` so a single ⌘Z reverts
the toggle alongside any option-list changes.

### 4.8 Consumer-side `handleTableWrite` branch

```ts
// features/equipment/routes/EquipmentTab.tsx — new branch in
// handleTableWrite

if (op.kind === "fieldDefMutation") {
  const optionKey = op.after.field_key;
  if (!isRoomOptionKey(optionKey)) return;  // ignore non-Rooms fields
  const replacements: Record<string, string | null> = {};
  for (const write of op.cellWrites ?? []) {
    if (write.fieldKey !== optionKey) continue;
    // Build the replacements map: { removed_option_id: replacement_id_or_null }
    // The op's cellWrites carry per-row replacements; we need to
    // collapse them into per-option-id replacements for
    // replaceRoomOptionsPayload.
    const previousOptionId = findRoomPreviousOptionId(roomsSlice, write.rowId, optionKey);
    if (previousOptionId) {
      replacements[previousOptionId] =
        typeof write.value === "string" ? write.value : null;
    }
  }
  await commitRoomsPayload(
    replaceRoomOptionsPayload(
      roomsSlice,
      optionKey,
      op.after.options ?? [],
      replacements,
    ),
    ACTIVE_ROOM_CONFLICT_MESSAGE,
    "Could not update room options.",
  );
  return;
}
```

`replaceRoomOptionsPayload` stays as-is. The branch above is the
only new code in the consumer; it replaces the existing
`saveOptions` callback (which is deleted along with the
`onSaveOptions` prop on `RoomsTable`).

The `findRoomPreviousOptionId(slice, rowId, optionKey)` helper
is a small new function in `features/equipment/lib.ts` that reads
the current slice's row for the prior option id — needed because
the op's `cellWrites` carry the *target* values, not the *source*
ids, and `replaceRoomOptionsPayload`'s API takes a per-option-id
replacement map. (Alternative considered: have the popover
populate `replacements` directly and carry it on the op — rejected
because that would specialize the generic `fieldDefMutation` op
shape to single-select cascades and would not generalize cleanly
to future field types. The collapse-per-option-id translation
belongs on the consumer side.)

### 4.9 Backward-compat / migration of in-place ops

There are **zero in-repo dispatchers** of `fieldDefMutation` today
(verified via `grep -rn "fieldDefMutation" frontend/src/`). The
union member exists in `types.ts:153` as a forward-compat slot from
Phase 0. The widening adds an optional field; no migration is
needed beyond Step 5 (deleting the dead `saveOptions` callback and
the `RoomOptionManager` component).

### 4.10 History / undo semantics

`dispatchWrite(forward, inverse)` pushes one history entry per
popover Save. ⌘Z replays `inverse`; ⌘⇧Z replays `forward`. Both legs
re-enter the consumer's `handleTableWrite` → the consumer
re-applies via `replaceRoomOptionsPayload`. The result is a clean
round-trip:

- Forward dispatch: `{before: optionsBefore, after: optionsAfter,
  cellWrites: [{rowId, fieldKey, value: null/replacementId}, ...]}`
- Inverse dispatch: `{before: optionsAfter, after: optionsBefore,
  cellWrites: [{rowId, fieldKey, value: originalOptionId}, ...]}`

The history entry survives the rows-identity reload from TanStack
Query because the existing `sessionKey`-based clear rule
(`DataTable.tsx:100-103`) keys history clearing on session-level
events (project switch, version switch), not on every successful
write. This is the Phase 2 fix that already underpins row-insert
undo across the post-write refetch; Phase 5 inherits it.

Edge case — **the user opens the popover, makes edits, then the
remote slice changes** (broadcast from another tab via
`useRoomsDraftBroadcast`): the popover should not silently overwrite
the new options. Phase 5 handles this by closing the popover when
the `fieldDef.options` identity changes underfoot and showing a
toast / inline message. See §12 Q4 for the open question on the
exact UX.

### 4.11 Test plan

Existing 247 tests pass unchanged (Phase 4 baseline). New tests:

- **`__tests__/optionReferences.test.ts` (NEW)** — pure helper
  coverage:
  - `optionReferenceCounts` counts each option id correctly across
    a row set; skips rows whose accessor returns null / undefined /
    non-string.
  - `missingOptionReferences` returns option ids referenced by
    rows but not present in the options list; empty for the
    clean-state case.
  - `normalizeOptionOrders` reassigns `order` to 0..N-1 in array
    order; trims labels.
- **`__tests__/columnHeaderDoubleClick.test.tsx` (NEW)** — header
  trigger behavior:
  - `data-field-editable="true"` and the hover chevron render for
    single_select columns only; absent for text / number /
    computed / attachment / argb_color.
  - `data-field-editable` is absent when `readOnly={true}` or
    `onWrite` is undefined, AND the double-click handler is
    unbound (synthetic `fireEvent.doubleClick` on the `<th>`
    is a no-op).
  - Double-click on an editable single_select header calls the
    `onEditField(fieldKey)` callback exactly once.
  - Double-click does not extend a column-select range (the
    second mousedown is suppressed inside the Phase 3 column-
    select gesture per §4.2).
- **`__tests__/FieldEditorPopover.test.tsx` (NEW)** — component
  behavior:
  - Renders one row per option in `order` ascending.
  - Editing a label updates the draft; Save dispatches with the
    new label.
  - Drag-reorder (fired via the dnd-kit `DndContext.onDragEnd`
    handler synthetically, per the Phase 4 test pattern) updates
    the draft order; Save dispatches with normalized orders.
  - Recolor: clicking a swatch in the color sub-popover updates
    the draft; Save dispatches with the new color.
  - Alphabetize button reorders the draft A→Z
    (case-insensitive); Save dispatches with normalized orders
    matching the alphabetical sequence.
  - Color-code options toggle: switching off sets
    `after.colorCodeOptions === false` on the dispatched op;
    switching it back on restores the default true. Toggle
    state with no other changes still allows Save (it's a real
    diff).
  - Add option: clicking ⊕ Add option appends an empty draft row
    with the next palette color; the label input is autofocused.
  - Delete with no references: removes the row immediately; Save
    dispatches a `fieldDefMutation` op with `after.options` lacking
    the entry, no `cellWrites`.
  - Delete with references opens the confirm sub-dialog.
  - Sub-dialog Confirm with Clear stages a `null` cascade for each
    referencing row; Save dispatches an op with `cellWrites: [{...
    value: null}]`.
  - Sub-dialog Confirm with Replace-with stages an
    option-id cascade; Save dispatches with `value: <new id>`.
  - Required-field constraint: with `fieldDef.required = true`,
    the sub-dialog disables the Clear radio and the Confirm
    button until a replacement is picked.
  - Duplicate label disables Save; clearing the duplicate
    re-enables.
  - Identical-to-original draft disables Save.
  - Cancel discards the draft and closes the popover.
  - Save calls `onClose` after the dispatch resolves; rejection
    surfaces the error inline and does not close the popover.
  - Inverse op carries the original option list AND the inverse
    cell writes (the original option ids per row).
- **`__tests__/DataTable.test.tsx` extensions** —
  integration-level (with a stubbed `onWrite`):
  - Hover chevron / `data-field-editable` attribute appears on
    single-select column headers and not on other column headers.
  - The double-click handler does not bind when `readOnly={true}`
    or `onWrite` is undefined.
  - Double-clicking a single-select header opens the
    FieldEditorPopover (anchored to that header).
  - The `renderHeaderActions` prop is removed from
    `DataTableProps` — verified at the type level (test imports
    `DataTableProps` and asserts the key absence via TypeScript
    `Exclude` shape).
  - Dispatching a `fieldDefMutation` op through Save then ⌘Z
    re-dispatches the inverse op (one history entry, one undo
    step).
- **`__tests__/useGridWriteReducer.test.ts` extensions** —
  reducer-level: the existing tests assert push/inverse/forward
  semantics; add a case for `fieldDefMutation` with `cellWrites`
  to confirm both halves round-trip through dispatch / undo / redo
  symmetrically.

Rendering Radix overlays in jsdom: the field-editor popover uses
`@radix-ui/react-popover` (same primitive as `FilterPopover`,
`SortPopover`, `ViewMenuOverflow`, `SingleSelectPopover`); the
nested confirm sub-dialog uses `@radix-ui/react-alert-dialog`
(same primitive as `ConfirmRowDeleteDialog`). Both portal their
content into `document.body`; queries traverse via
`screen.getByRole`. Drag-and-drop in jsdom: fire
`DndContext.onDragEnd` directly with a synthetic event — same
pattern as Phase 4's `FilterPopover.test.tsx`.

The Rooms `lib.test.ts` test cases for the moved helpers
(`optionReferenceCounts`, `missingOptionReferences`,
`normalizeOptionOrders`) relocate into
`optionReferences.test.ts`; the test bodies are otherwise
unchanged (the helpers are pure and the new accessor parameter
defaults to the existing rooms-shape accessor in the relocated
tests).

## 5. Execution order

Four steps (resolution #10 collapses the original Steps 3-4-5
into Steps 3 and 4 — no parallel-run window). Each leaves the
tree green (`make test`, `make typecheck`, `make lint`). Commit
per step.

### Step 1 — Type widening + helper relocation + slot removal

- Widen `WriteOp.kind = "fieldDefMutation"` in `types.ts` with
  optional `cellWrites?: CellWrite[]`. Update the inline doc
  comment per §4.4.
- Add the `colorCodeOptions?: boolean` slot to `FieldDef` in
  `types.ts`.
- **Remove the `renderHeaderActions` prop** from `DataTableProps`
  in `types.ts` and the corresponding pass-through chain
  (`DataTable.tsx` → `GridHeader.tsx`). Drop the per-column
  render block in `RoomsTable.tsx` that supplied
  `<RoomOptionManager>` to the slot. The consumer is now without
  any option-management UI in the grid header until Step 3 lands
  the popover — accepted because the local in-row inline editing
  via `SingleSelectPopover` (Phase 1) still works and is
  sufficient for daily editing during the Step 1–2 window.
- Update the renderer paths (`formatDisplayCellValue` in
  `data-table/lib.ts` and the consumer's
  `RoomsTable.optionPill`) to read `fieldDef.colorCodeOptions`
  and skip the `--option-color` style when explicitly false.
  Default true → existing behavior preserved.
- Add `OPTION_COLOR_PALETTE` export to `data-table/lib.ts`;
  refactor the existing `nextOptionColor` to read from it
  (behavior preserved).
- Add `optionReferenceCounts<TRow>`,
  `missingOptionReferences<TRow>`, `normalizeOptionOrders` to
  `data-table/lib.ts`. Re-export from `data-table/index.ts`.
- Delete `optionReferenceCounts`, `missingOptionReferences`,
  `normalizeOptionOrders` from `features/equipment/lib.ts`.
  Relocated import path:
  `import { normalizeOptionOrders } from "../../shared/ui/data-table"`.
- Add `__tests__/optionReferences.test.ts` with the helper-level
  coverage (port from `features/equipment/lib.test.ts`).
- At this step, no new UI is visible. `renderHeaderActions` and
  the consumer-side option-manager button are both gone. The
  consumer's `RoomOptionManager.tsx` file is still on disk (to
  delete in Step 4) but is not rendered.

### Step 2 — Column-header double-click trigger

- Extend `GridHeader.tsx` per §4.2: add `readOnly` and
  `hasWriteHandler` props (DataTable threads them in); compute
  `isEditableSingleSelect` per `<th>`; bind `onDoubleClick`
  conditionally; render the hover chevron `▾` next to the
  label; set `data-field-editable` and
  `data-field-editor-open` attributes. Add a new
  `onEditField: (fieldKey: string) => void` prop.
- Capture the per-column header `<th>` refs in a
  `headerCellRefByFieldKey` Map so Step 3 can use them as the
  Popover.Anchor.
- Patch `useGridPointerDrag.onColumnMouseDown` to short-circuit
  when `event.detail === 2` (the second mousedown of a
  double-click must not extend an existing column-select
  range).
- Add CSS for the hover chevron and the editable-pointer
  cursor per §4.2.
- Wire `DataTable.tsx` to (a) own
  `fieldEditorOpenForFieldKey: string | null` state, (b) pass
  `onEditField` setter that updates that state. The popover
  itself lands in Step 3; at Step 2, the setter wraps with a
  `console.warn("FieldEditorPopover not yet wired")` so the
  test can assert the callback fires.
- Test: `__tests__/columnHeaderDoubleClick.test.tsx` per §4.11.
- At this step, double-clicking a single-select header in the
  Rooms grid logs to console; the hover chevron is visible;
  cursor turns pointer.

### Step 3 — FieldEditorPopover (no delete cascade yet)

- **Zero new npm dependencies** (resolution #3). The popover
  surface uses the existing `@radix-ui/react-popover`; the
  Step 4 confirm sub-dialog uses the existing
  `@radix-ui/react-alert-dialog`.
- Create `components/FieldEditorPopover.tsx` per §4.3 wrapped in
  `Popover.Root` + `Popover.Anchor` (anchored to the header
  `<th>` ref from Step 2). Owns: read-only field-name heading,
  Color-code options toggle, Alphabetize button, dnd-kit
  sortable option list, per-row label input + color circle
  sub-popover + reference chip + delete button, ⊕ Add option
  entry, validation surface, Cancel / Save footer.
- Wire `DataTable.tsx` to render the popover when
  `fieldEditorOpenForFieldKey !== null`, replacing the Step-2
  stub callback with the open-setter.
- Step 3's Delete button always removes the option from the
  draft immediately (no sub-dialog yet — Step 4 adds the
  cascade flow). For reference-bearing options, Step 3 delete
  is intentionally lossy; the test asserts that the resulting
  save dispatches with `cellWrites: undefined` and the
  consumer's replace path raises (existing
  `replaceRoomOptionsPayload` throws on a missing replacement
  for a referenced required field — the popover surfaces the
  error inline). Step 4 fixes the lossy flow.
- Save handler dispatches the `fieldDefMutation` op + inverse
  via `dispatchWrite`. No `cellWrites` yet for the delete path.
- Color sub-popover: each option's color circle opens a sibling
  `Popover.Root` with the 6 `OPTION_COLOR_PALETTE` swatches in
  a 3×2 grid. Picking a swatch updates the draft and closes
  the sub-popover.
- Test: `__tests__/FieldEditorPopover.test.tsx` covering Save,
  drag-reorder, recolor, rename, add, Alphabetize, Color-code
  toggle, simple delete, duplicate-label guard, Cancel,
  Esc-to-close, click-outside-to-close.
- At this step, the full reorder / recolor / rename / add /
  alphabetize / color-code / save loop works end-to-end against
  Rooms. Delete-with-references intentionally fails (raises a
  banner). Verify §10 steps 3–8 in browser.

### Step 4 — ConfirmDeleteOptionDialog + cascade staging + consumer cutover

- Create `components/ConfirmDeleteOptionDialog.tsx` per §4.5
  (Radix AlertDialog rendered via its own Portal, layered
  above the FieldEditorPopover).
- Add the `stagedCellCascades` state to `FieldEditorPopover`.
  Delete button on a referenced option opens the sub-dialog;
  Confirm stages the cascade choice; Cancel returns focus to
  the row's delete button without staging.
- Required-clamp logic: when `fieldDef.required &&
  referenceCount > 0`, the Clear radio is disabled; the
  sub-dialog defaults to the first available Replace-with
  option; Confirm is disabled until a replacement is picked.
- Save handler builds the `cellWrites` array from
  `stagedCellCascades` and attaches it to both forward and
  inverse ops per §4.7. Capture the per-row original option
  ids at popover-open time into `originalCellValueByRowId` so
  the inverse is lossless even after multiple cascade
  decisions.
- **Consumer cutover** (resolution #10 — no parallel-run
  window):
  - Add the `fieldDefMutation` branch to
    `EquipmentTab.handleTableWrite` per §4.8. Implement
    `findRoomPreviousOptionId` helper in
    `features/equipment/lib.ts`.
  - Delete `features/equipment/components/RoomOptionManager.tsx`.
  - Drop the `onSaveOptions` prop from `RoomsTable.tsx` and
    from the `<RoomsTable>` call site in `EquipmentTab.tsx`.
  - Remove the `saveOptions` callback from `EquipmentTab.tsx`.
  - Run `grep -rn "onSaveOptions\|RoomOptionManager" frontend/src/`
    and clean up any stragglers (test fixtures, type re-exports,
    etc.).
  - Update `App.test.tsx` and `EquipmentTab.test.tsx` to drive
    the new popover via `fireEvent.doubleClick` on the column
    header `<th>` instead of clicking the old "Options" button.
- Test: extend `__tests__/FieldEditorPopover.test.tsx` for the
  cascade flows per §4.11.
- Run `make typecheck && make lint && make test && make format`.
  Run `pnpm run build`.
- At this step, the consumer has zero option-management code.
  Every option edit flows through the library. Verify §10 walk
  end-to-end in Chrome and Safari; record pass/fail in §11.

### Step 5 (conditional) — demo-walk fixes

- Same shape as Phase 4's Step 6. Only if the §10 walk surfaces
  fixes; otherwise omit and let Step 4 be the closer.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Widening `WriteOp.kind = "fieldDefMutation"` breaks an existing dispatcher. | Zero in-repo dispatchers today (`grep -rn "fieldDefMutation" frontend/src/` returns only the union definition). The widening is a strict superset; consumers that never read `cellWrites` continue to compile. |
| `replaceRoomOptionsPayload` rejects a delete-with-references when the cellWrites cascade doesn't supply a replacement for a required field. | The FieldEditorPopover enforces the required-clamp at the sub-dialog level (criterion 11). The Save button is disabled until every reference-bearing required option has a Replace-with cascade staged. Tested. |
| Inverse cell-writes drift from original state if the user makes multiple cascade decisions before Save (e.g. delete `Roof` → Replace with `Attic`, then delete `Attic` → Clear). | Capture the **original** per-row option ids at popover-open time into `originalCellValueByRowId` and use them for the inverse, not the post-staging state. Phase 5 §4.7 documents this; tested. |
| Popover stays open while the remote slice changes underfoot (another tab edits options for the same field). | When `fieldDef.options` identity changes during popover lifetime, close the popover and emit a toast (resolution #4). Staged cascades discard; the user re-opens against the new option set. |
| Drag-reorder + recolor + rename + delete-with-cascade compose into a single Save — Save dispatches a giant `fieldDefMutation` op that hides which sub-gesture caused the change. | Acceptable. The op is semantically "the user changed the options"; the inverse restores the prior state byte-identically. The diff between `before` and `after` field defs makes the change auditable; the cell writes are explicit. |
| Color swatch popover overlaps the option row's delete button on narrow viewports. | Radix Popover handles collision avoidance via `side` / `align` props. The swatch picker is 3x2 (small), unlikely to clip; manual Safari walk verifies. |
| The required-clamp disables Clear but the user expects "Cancel" to bail without committing the empty Replace-with picker. | The Cancel button on the sub-dialog always closes without staging, regardless of clamp state. Tested. |
| `@dnd-kit` setup inside a Radix Popover Portal loses pointer events. | Phase 4's `FilterPopover` already runs `@dnd-kit/sortable` inside a Radix Popover Portal without issue; the same pattern applies here. Verified in `webapp-testing` MCP walk in Step 3. |
| Double-click on the column header collides with the Phase 3 column-select gesture (single mousedown selects the column; a second mousedown of a double-click could extend the range). | `useGridPointerDrag.onColumnMouseDown` short-circuits when `event.detail === 2`. Documented in §4.2; tested in `columnHeaderDoubleClick.test.tsx`. |
| The consumer's `RoomOptionManager` ships a "Missing references" warning chip that the new library popover omits. | The Step 1 helper `missingOptionReferences` ports the logic. The popover renders a `N rows reference unknown options. Delete or remap them.` banner below the option list when the helper returns non-empty. Tested. |
| The popover anchored to the column header gets clipped or hidden when the header is near the viewport edge. | Radix Popover's `collisionPadding` + automatic flip handles edge cases. Configured with `side="bottom"` `align="start"` `sideOffset={6}` `collisionPadding={8}`. Manual Safari + narrow-viewport verification in §10. |
| Double-clicking opens the popover, but the user also double-clicks cells to open the row-edit modal — they collide. | Cell double-click (`onCellOpen` → `onRowOpen`) is handled at the `<td>` level; header double-click is at the `<th>` level. Distinct event targets; no collision. Verified in `columnHeaderDoubleClick.test.tsx`. |
| Reorder changes the `option.order` ints but the existing `replaceRoomOptionsPayload` doesn't re-call `normalizeOptionOrders` on the incoming options. | `FieldEditorPopover` calls `normalizeOptionOrders(draftOptions)` inside the Save handler (§4.7), so the `after.options` arrives normalized. `replaceRoomOptionsPayload` already calls `normalizeOptionOrders` defensively (`lib.ts:242`), so the result stays normalized regardless. |
| The `findRoomPreviousOptionId` consumer-side helper duplicates a lookup the library already has. | Acceptable — the library doesn't know the Rooms slice shape. The helper is two lines (`slice.rooms.find(r => r.id === rowId)?.[roomFieldForOptionKey(key)]`); not worth a generic abstraction. Documented as a per-consumer translation layer in §4.8. |
| The library's Esc-closes-popover conflicts with the Phase 0 wrapper's Esc-clears-active-cell. | Radix Popover captures Esc inside the Portal before it bubbles to the grid wrapper. Confirmed via Phase 1's SingleSelectPopover and Phase 4's FilterPopover precedents. |
| The Phase 4 `data-axis-tint` attribute on `<th>` shifts the hover-chevron CSS selector. | The selector `.data-table-th[data-field-editable="true"]:hover .data-table-header-edit-chevron` matches regardless of axis-tint attribute. Verified by reading the Phase 4 GridHeader markup. |
| Renaming an option in mid-flight (a row has the option in-flight via SingleSelectPopover) corrupts the open editor's option list. | The popover reads `fieldDef.options` from props each render. A Save during an open inline edit reflects in the popover at next render. Acceptable; the user-visible behavior matches AirTable. |

## 7. What this phase explicitly does not do

- **No multi-select field type.** Parent plan §16 defers
  multi-select to post-parity. The library's `single_select`
  registry entry stays single-cardinality.
- **No long-text / attachment / row-detail side panel.** Parent
  plan §14 routes these to the catalog-migration body of work.
- **No new color palette.** The existing 6-color list stays;
  Phase 6's 14-entry pre-mixed tint palette is a separate
  artifact (used for cell tint cascade, not pill colors).
- **No per-option icon / description.** AirTable's option editor
  supports both; the parent plan §11 does not, and `FieldOption`
  carries no slots for them. Deferred.
- **No option-list import / export (CSV paste).** AirTable
  supports it; deferred — the parent plan does not call for it.
- **No history of who changed which option when.** Versioned
  history is the project_document layer's responsibility, not
  the table's.
- **No per-row partial edit of option lists.** Inline cell
  popover creates a single option (Phase 1); whole-list
  management lives only in the field-editor popover. The two paths are
  intentional — different gestures, different write semantics.
- **No drag-to-reorder across columns (e.g. moving an option
  from `floor_level` to `building_zone`).** Options are owned
  by their field; moving one across fields is a delete + create
  workflow the user runs manually.
- **No "Restore deleted options" recovery UX.** ⌘Z restores
  in-session; a hard refresh discards the in-memory history.
  Acceptable per parent plan §6 sequencing rule 4 (undo stays
  in-memory per session).
- **No column hide / rename / pin items in the `⋯` menu.** Those
  belong to a future column-config phase. The Phase 5 menu has
  exactly one item.
- **No keyboard shortcut to open the option editor.** AirTable
  uses no shortcut either; the trigger is `⋯` → click. A future
  command-palette phase could add one.
- **No bulk-delete options.** Each option deletes via its own
  row's `×` button; the popover does not multi-select. Acceptable
  — even a 20-option list is fast to clean up one at a time.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — type widening + helper relocation + slot removal  | 1.5 | 2.5 |
| 2 — column-header double-click trigger                | 1.5 | 2.5 |
| 3 — FieldEditorPopover (no cascade yet)               | 4.0 | 5.5 |
| 4 — ConfirmDeleteOptionDialog + cascade + cutover     | 3.5 | 5.0 |
| 5 — post-walk fixes (conditional)                     | 0.5 | 1.0 |
| **Total**                                             | **11.0** | **16.5** |

Parent plan budgeted 10–14; this estimate's high end pushes 2.5
hr past — slightly less than the original draft because:

- Resolution #3 removes the `@radix-ui/react-dialog` add (saves
  the release-age wait + Dialog-vs-Popover composition work).
- Resolution #10 collapses the original Step 4 (cascade) +
  Step 5 (consumer cleanup) into one cutover, saving the
  parallel-run plumbing that would have kept the old + new
  paths alive simultaneously.

The allocations still account for:

- The cascade-staging state machine in Step 4 (delete sub-dialog
  staging + inverse-cell capture is the trickiest piece; no
  precedent in earlier phases).
- The popover-internal drag-reorder + color sub-popover
  composition (each is straightforward, but they must cooperate
  inside a single Radix Popover Portal).
- The consumer cutover in Step 4 affects three files and at
  least four test files; the mechanical updates can take an
  hour by themselves.

The 5.5 hr high on Step 3 is the largest single allocation —
the popover body has four interactive sub-surfaces (option
rows, color sub-popovers, ⊕ Add option, Cancel / Save footer)
plus the Color-code toggle and Alphabetize button, all backed by
a non-trivial draft-state model.

## 9. Commit plan

One commit per step. Subject prefixes match the data-table
convention from Phases 0–4:

1. `chore(data-table): widen fieldDefMutation op + relocate option helpers + drop renderHeaderActions`
2. `feat(data-table): column header double-click trigger`
3. `feat(data-table): field-editor popover (reorder/recolor/rename/add/alphabetize/color-code)`
4. `feat(data-table): field-editor delete-with-references cascade + route Rooms options through fieldDefMutation`
5. `chore(data-table): Phase 5 demo fixes` (only if post-walk
   polish is needed; otherwise omit and let Step 4 be the closer)

## 10. Demo script

After Step 5, walk this end-to-end against Rooms in a fresh browser
session. Record pass/fail in §11. Repeat in Safari.

1. `make dev` → Postgres up. `make backend` + `make frontend`.
2. Sign in as editor, open any project with ≥1 room and ≥1
   non-trivial floor-level option list (e.g. Ground / 1st / 2nd /
   Roof / Basement). Navigate to Equipment → Rooms.
3. **Hover affordance.** Hover the `floor_level` header — the
   `▾` chevron fades in next to the label and the cursor
   becomes a pointer. Hover `name` (text) — no chevron, default
   cursor. Hover `num_people` (number) — no chevron. Hover
   `building_zone` (single_select) — chevron visible.
4. **Open the field-editor popover.** Double-click the
   `floor_level` header. Popover opens, anchored below with a
   tail / arrow pointing up to the header. Heading reads
   `Floor`. The Options section lists the floor options in
   `order` ascending. The Color-code options toggle reads on;
   the `↕ Alphabetize` button sits to its right.
5. **Rename non-destructive.** Click `1st`'s label input,
   replace with `First Floor`, Tab out. Save. Popover closes.
   The grid re-renders: every row whose `floor_level` was `1st`
   now reads `First Floor`. Download the rooms JSON (Phase 4
   demo step 19) — `floor_level` cells still carry the same
   `opt_first` ids; only the option's label changed.
6. **Reorder via drag.** Re-open the popover. Drag `Roof` to
   the top of the list. Save. The grid re-renders. If a sort
   rule on `floor_level` is active (e.g. ascending), rows now
   sort with `Roof` first (single-select sort uses option
   order).
6a. **Alphabetize.** Re-open. Click `↕ Alphabetize`. The draft
    list re-sorts case-insensitively A→Z. Save. The persisted
    `order` ints reflect the alphabetical order.
6b. **Color-code options toggle.** Re-open. Click `Color-code
    options` toggle to off. The option rows still show their
    color circles in the popover (config surface), but every
    pill in the grid below switches to a neutral background.
    Save. Re-open and toggle back on. Save. Pills return to
    their colors. Each Save commits one `fieldDefMutation` op.
7. **Recolor via color circle.** Re-open. Click the color
   circle next to `Roof`. A sub-popover opens with the 6
   palette swatches in a 3×2 grid. Pick purple. The circle
   updates in the popover; the pill colors don't change until
   Save. Save. Every row pill for `Roof` is now purple.
8. **Add option.** Click `⊕ Add option`. New row appears with
   empty label, focus on the label input. Type `Attic`. Save.
   The option is appended. Open the cell popover on a
   `floor_level` cell → `Attic` appears in the option list.
9. **Delete option with no references.** Re-open the popover.
   Delete `Attic` (no rows reference it). The row disappears
   immediately, no sub-dialog. Save. The grid's option list
   updates; cell popovers no longer show `Attic`.
10. **Delete option with references — Clear path.** Verify
    `building_zone` is **not** required in the field defs.
    Pick a zone option referenced by ≥1 room (e.g. `Attic`).
    Double-click the `building_zone` header → popover opens →
    Delete the option. Sub-dialog opens:
    *"N rows reference 'Attic'."* Pick **Clear**. Confirm.
    Sub-dialog closes; the row disappears from the popover.
    Save. The grid renders the affected room(s) with the
    "Unassigned" muted-cell style.
11. **⌘Z restores both.** ⌘Z. The option is restored; the
    affected room's pill returns. ⌘⇧Z re-applies the deletion +
    cell clear in one entry.
12. **Delete option with references — Replace-with path.** Open
    `building_zone` options. Delete a referenced option (e.g.
    `Attic` again). Sub-dialog opens; pick **Replace with:
    Hallway**. Confirm. Save. The grid renders the affected
    room(s) with the `Hallway` pill.
13. **Required-field clamp.** Open `floor_level` options
    (required). Delete an option with ≥1 reference. Sub-dialog
    opens; the Clear radio is disabled, help line reads "Floor
    is required — pick a replacement option." Confirm is
    disabled until a Replace-with pick. Pick one → Confirm
    enables → Confirm → Save → grid updates.
14. **Duplicate-label guard.** Open `floor_level`. Rename
    `Ground` to `1st`. Save button disables; inline message
    `Option labels must be unique.` Restore label → Save
    re-enables.
15. **Cancel discards silently.** Open the popover. Reorder
    and rename. Click Cancel (or hit Esc). No prompt — the
    draft discards silently (resolution #5). Re-open: original
    order and labels intact.
16. **Read-only mode.** Sign in as Viewer (or open a locked
    version). Hover the `floor_level` header — no chevron, no
    pointer cursor. Double-click is a no-op.
    Toolbar Filter / Sort still work. Inline edit and option
    edit are blocked.
17. **No Phase 0/1/2/3/4 regressions.** Inline cell popover
    create-on-edit still works (type a new floor name in a
    cell → cell-popover footer offers Create → option appears
    via the existing Phase 1 `cell` + `OptionListDelta` path —
    independent of the field-editor popover path). Filter and
    sort popovers work; axis tints render correctly when
    filtered / sorted by a single-select column. Row insert /
    delete, paste, drag, autoscroll, perimeter outline all
    unchanged.
18. **Round-trip with persistence.** Save changes; refresh the
    page (clears the in-memory history). The persisted option
    list reflects the saves. ⌘Z after refresh is a no-op (the
    history is gone, per parent plan §6 rule 4).
19. **Type-checks / lint / tests / build.** Run `make
    typecheck && make lint && make test && pnpm run build` in
    a separate terminal — everything clean.
20. **Safari walk.** Repeat steps 4, 5, 7, 10, 11, 13 in
    Safari. Pay special attention to (a) the nested-AlertDialog
    focus return after the confirm sub-dialog closes (Safari's
    Radix focus restoration has a history of quirks; Phase 2
    hit one and folded the fix into its post-walk patch), and
    (b) the popover anchoring under horizontal scroll — the
    grid may be wider than the viewport in projects with many
    columns; the popover should track the column header as the
    user scrolls horizontally underneath.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — type widening + helper relocation + slot removal | — | — | — |
| 2 — column-header double-click trigger              | — | — | — |
| 3 — FieldEditorPopover (no cascade yet)             | — | — | — |
| 4 — ConfirmDeleteOptionDialog + cascade + cutover   | — | — | — |
| 5 — post-walk fixes (conditional)                   | — | — | — |
| Phase 5 overall                                     | — | — | — |

## 12. Open questions — resolved 2026-05-24

Ed walked the ten open questions on 2026-05-24. Resolutions
below; the plan body above is already updated to reflect them.

1. **Menu-then-modal vs. direct-to-modal.** — RESOLVED.
   Decision: **direct-to-popover, double-click the header.**
   Skip the intermediate `⋯` menu entirely. AirTable's
   reference (image 01-column-header-typical.png — note the
   hover chevron `▾` on the active header) opens the editor on
   header double-click. Phase 5 follows: hover chevron as the
   affordance, double-click as the trigger, the popover surface
   opens directly. The `renderHeaderActions` slot is removed in
   the same phase (see resolution #10).

2. **Trigger glyph.** — RESOLVED.
   Decision: **horizontal ellipsis `...` (literal three-dot)**
   for the rare future cases where a triggerable glyph is
   needed inside the popover (e.g. an option-row context
   action). For the column-header affordance, the hover
   chevron `▾` (matching AirTable image 01) is the indicator;
   no `⋯` button renders at the header level.

3. **AirTable screenshot reference for layout.** — RESOLVED.
   Decision: **match AirTable UI/UX as closely as possible.**
   Ed supplied two screenshots, saved under
   `research/airtable-screenshots/field-editor-2026-05-24/`:
   - `01-column-header-typical.png` — column header in idle /
     active state, showing the hover chevron and the
     field-type icon left of the label;
   - `02-field-editor-popover.png` — full field-editor popover
     opened from a header double-click, showing the option
     list with drag handles, color circles, label inputs, the
     Color-code options toggle, and the Alphabetize button.
   The §4.3 layout sketch is updated to match. Field-name /
   field-type / description / default editing visible in
   AirTable's popover are deferred (see §7) — Phase 5 ships
   the options subset of AirTable's full field editor.

4. **Underfoot remote-change UX.** — RESOLVED.
   Decision: **close the popover + emit a toast** when the
   `fieldDef.options` identity changes underfoot. Staged
   cascades are discarded; the user re-opens against the new
   option set. Matches Phase 2's row-delete-during-conflict
   handling.

5. **Unsaved-changes warning on Cancel.** — RESOLVED.
   Decision: **silently discard.** No `window.confirm`, no
   dirty-state badge — Cancel / Esc / click-outside all close
   the popover and throw away the draft. A draft is cheap to
   rebuild; matches AirTable.

6. **Color picker UX.** — RESOLVED.
   Decision: **swatch popover** — clicking the color circle
   opens a sub-Popover with the 6 `OPTION_COLOR_PALETTE`
   swatches in a 3×2 grid; clicking a swatch sets the draft
   option's color and closes the sub-popover.

7. **Sub-dialog UI for cascade choice.** — RESOLVED.
   Decision: **radio buttons** (Clear / Replace with…) inside
   a Radix AlertDialog. The Replace-with picker nests under
   its radio.

8. **Per-option order-int format.** — RESOLVED.
   Decision: **integer reindex**, via
   `normalizeOptionOrders`. No float ranks, no CRDT.

9. **Cross-browser verification gating.** — RESOLVED.
   Decision: **Chrome + Safari only; no Firefox.** Same default
   as Phases 3 and 4.

10. **Out-of-date code & API cleanup.** — RESOLVED.
    Decision: **remove all out-of-date code and API fully — no
    backwards-compat shims, no parallel-run window, no
    deprecation period.** No existing users, no existing
    deploy, no production data on the old shape. Concretely:
    - The `renderHeaderActions` prop is removed entirely from
      `DataTableProps` (Step 1). Phase 6 re-adds a slot in
      whatever shape its aggregation picker needs.
    - `RoomOptionManager.tsx` is deleted (Step 4).
    - `onSaveOptions` prop on `RoomsTable` is removed
      verbatim (Step 4).
    - `EquipmentTab.saveOptions` callback is removed
      verbatim (Step 4).
    - `optionReferenceCounts` / `missingOptionReferences` /
      `normalizeOptionOrders` move out of
      `features/equipment/lib.ts` into
      `shared/ui/data-table/lib.ts` with no compatibility
      re-export (Step 1).
    - No parallel-run window: Steps 3–4 do not keep the old
      RoomOptionManager wired alongside the new popover.
      Step 1 already removes the consumer's grid-header
      render of `<RoomOptionManager>`; the user uses the
      cell-popover inline create flow (Phase 1) during the
      Step 1–2 window, then the field-editor popover
      lands in Step 3.
    - The `replaceRoomOptionsPayload` function is kept (the
      cutover branch in `handleTableWrite` calls it) but any
      orphaned helpers / re-exports / type aliases that no
      longer have a caller are deleted in Step 4's
      `grep`-driven cleanup pass.

## 13. Parent-plan delta

This Phase 5 plan supersedes two specifics from parent
`docs/plans/2026-05-23/datatable-airtable-parity.md §11`, both
in service of AirTable parity (resolution #3) and the
no-backwards-compat cleanup (resolution #10):

- **Parent §11 "Trigger"** reads "Column header `⋯` menu →
  'Edit options…' (only present when
  `field_type === 'single_select'`)." Phase 5 reverses the `⋯`
  half: the trigger is **double-click the column header**, no
  intermediate menu. The hover chevron `▾` is the affordance.
  This matches AirTable (image
  `research/airtable-screenshots/field-editor-2026-05-24/01-column-header-typical.png`).
  Parent §11's "only present when single_select" half stands —
  Phase 5 only binds the double-click handler on single_select
  fields.

- **Parent §11 "Modal (shadcn Dialog)"** is reversed to a
  **Popover anchored to the column header** (matching AirTable
  image 02). The popover uses the existing
  `@radix-ui/react-popover`; no `@radix-ui/react-dialog` add.
  The delete-with-impact confirm still escalates to a Radix
  AlertDialog (Phase 2 precedent), but the primary editing
  surface is a popover, not a modal.

This Phase 5 plan also implements parent §11 verbatim on:

- **Parent §11 "Recolor"** says the swatch palette is the
  14-entry Phase 6 palette and that for Phase 5 the current
  6-color `lib.ts` palette suffices. Phase 5 ships the 6-color
  palette unchanged and exports it as `OPTION_COLOR_PALETTE`
  for the recolor picker. Phase 6 swaps the palette content;
  the export name and contract stay.

- **Parent §11 "Delete with row-impact confirm"** is
  implemented verbatim: Clear vs Replace-with radios in a
  nested AlertDialog, required-clamp on the Clear radio when
  the field is required, lossless ⌘Z via the inverse
  cellWrites array.

Status table update (post-Step 4 sign-off): the parent plan's
§18 should add a row for Phase 5 with the sign-off date and a
one-line note matching Phases 1–4's style. Suggested entry:

> | 5 | YYYY-MM-DD | ✅ YYYY-MM-DD | All N steps landed; M tests
> passing; `RoomOptionManager` deleted (221 LOC);
> `renderHeaderActions` slot removed; option edits route
> through `WriteOp.kind = "fieldDefMutation"` with cascade
> support; double-click-header trigger + Radix Popover editor
> (no new deps); parity gate met — every core AirTable
> behavior runs against `<DataTable>`. |

And one bonus deliverable beyond what the parent plan called
for, lifted directly from AirTable's editor:

- **Color-code options toggle** (when off, pills render with a
  neutral background; option colors stay in the field def).
  Persisted on a new optional `FieldDef.colorCodeOptions?:
  boolean` slot.
- **Alphabetize button** (one-click sort the draft option list
  A→Z, case-insensitive).
