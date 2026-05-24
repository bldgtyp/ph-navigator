---
DATE: 2026-05-24
TIME: planning
STATUS: Draft. Fourth in the 9-plan AirTable-parity polish series.
        Sequenced 4/9.
SCOPE: When a single cell is active (focused), typing any printable
       character replaces the cell value and enters edit mode —
       matching AirTable. Double-click and F2 still open the editor
       in "edit, don't replace" mode with the existing value
       pre-filled. Library-only.
PARENT-STORY: context/user-stories/31-data-table-enhancements.md
             (US-TBL-EDIT-2)
RELATED:
  - frontend/src/shared/ui/data-table/hooks/useGridKeyboard.ts
    (keyboard dispatch — adds printable-char handler)
  - frontend/src/shared/ui/data-table/hooks/useGridEdit.ts
    (edit state machine — add `beginEditWith(initialValue)` entry
    point alongside the existing edit-with-prefill path)
  - frontend/src/shared/ui/data-table/components/InlineCellEditor.tsx
  - frontend/src/shared/ui/data-table/hooks/useGridSelection.ts
---

# Plan 04 — Type-to-edit on active cell

## 1. Why this plan exists

Today, the only way to enter inline-edit mode is double-click (or
single-click into an already-active cell — confirm during Step 1).
Excel and AirTable both let the user type any printable character on
an active cell to immediately start editing with the typed character
as the *new* value (the prior value is replaced, not appended). For
data-entry workflows — typing a list of room numbers, filling out
fan power values across a column — this halves the keystrokes.

This plan adds the type-to-replace path while preserving:

- Double-click → edit with prefill (existing).
- F2 / Enter → edit with prefill (existing or to be added — see §3).
- Type printable → edit with the typed char as the new value (new).

The plan is constrained to single-cell selections (multi-cell typing
goes through fill / paste primitives that already exist; using
typing on a multi-cell selection would be a surprise).

## 2. Binding constraints

1. **Library-only.** Edits in `useGridKeyboard.ts`, `useGridEdit.ts`,
   and possibly `useGridSelection.ts`. Zero consumer touches.
2. **Type-to-replace only fires on single-cell active state.** If
   `selection.normalizedRange` covers more than one cell, the
   keystroke is ignored (typing on a multi-cell selection is the
   user's problem to solve — they should reduce the selection first
   or use paste / fill).
3. **Read-only cells block typing entirely.** A printable char on a
   read-only column / read-only mode / locked-version cell is a
   no-op + announce (`This cell is read-only.`).
4. **Single-select cells route through `SingleSelectPopover`** per
   plan 05 (US-TBL-SELECT-1): typing on an active single-select
   cell pre-fills the popover's search input. That wiring lives in
   plan 05; this plan only handles text + number + boolean-checkbox
   cells. Boolean is keyboard-only via Space (existing) — typing
   any other char on a checkbox cell is a no-op.
5. **No double-write.** The first typed character is the *complete
   new value* (replaces prior value). Subsequent keystrokes append
   normally (the editor is now in edit mode handling its own
   keystrokes).
6. **Existing double-click + F2 paths preserved.** They open the
   editor with the *prior* value pre-filled and cursor at end —
   "edit, don't replace."
7. **Escape cancels typing-mode editing** the same as any other
   edit — restores prior value, no draft write.
8. **Printable character detection: `event.key.length === 1` plus a
   guard against modifier keys.** Captures alphanumeric, symbols,
   space. Excludes arrow keys, Enter, Tab, Escape, function keys,
   meta combinations (⌘C, ⌘V, ⌘D etc.), and dead keys.

## 3. Acceptance criteria

1. **Type-to-replace on text cell.** Active cell on row 3 `name` =
   "Bedroom". Press `K`. Cell enters edit mode with value `"K"`
   (NOT `"BedroomK"`). Enter commits `"K"`.
2. **Type-to-replace on number cell.** Active cell on row 3
   `num_people` = 2. Press `7`. Cell enters edit mode with value
   `"7"`. Enter commits `7` (number coercion via existing
   `coerceFieldValue`).
3. **Sequential typing appends.** Press `K` then `i` then `t`.
   Editor shows `"Kit"`. Enter commits `"Kit"`. No race where `"K"`
   commits before `i` types.
4. **F2 opens with prior value.** Active cell, value "Bedroom",
   press F2. Editor opens with value "Bedroom"; cursor at end. Type
   ` 1` → value becomes "Bedroom 1". Enter commits.
5. **Enter opens with prior value.** Same as F2 (matches Excel
   default).
6. **Double-click opens with prior value.** Existing behavior; no
   regression.
7. **Multi-cell selection ignores typing.** Select rows 3–5 on
   `name`. Press `K`. No-op + announce (`Select a single cell to
   start typing.`).
8. **Read-only cell ignores typing.** Active cell on a read-only
   column. Press `K`. No-op + announce (`This cell is read-only.`).
9. **Modifier keys ignored.** ⌘C, ⌘D, ⌘R, ⌘Z still work; typing
   `c` while ⌘ is held does NOT begin an edit.
10. **Arrow keys / Tab / Escape unchanged.** No regression — they
    still move the active cell or close existing editors.
11. **Single-select cells (when plan 05 lands) pre-fill popover
    search with the typed char.** Not in this plan's scope; this
    plan's keyboard handler skips single-select cells.
12. **Space key on checkbox toggles** (existing behavior, no
    regression). Space on a text cell starts typing a space.
13. **Backspace / Delete on active cell clears value + enters edit
    mode** with empty string. (Same shape as typing — replace, not
    append.)

## 4. Target architecture

### 4.1 File changes

```
frontend/src/shared/ui/data-table/
  hooks/
    useGridKeyboard.ts       extended: add a printable-char handler
                             that fires when:
                             - `event.key.length === 1`
                             - `!event.metaKey && !event.ctrlKey && !event.altKey`
                             - selection is a single cell
                             - the active cell's column is editable
                               (not read-only)
                             - no editor is currently active
                             The handler calls a new
                             `onTypeToEdit(key: string)` callback
                             passed from DataTable.tsx. Returns true
                             (handled) to suppress default. Also add
                             Backspace / Delete handler that calls
                             `onTypeToEdit("")`.

                             F2 already maps in the existing dispatch
                             — confirm it routes to the existing
                             "open editor with prior value" path.
                             Enter likewise (confirm).
    useGridEdit.ts           extended: add `beginEditWith(initialValue:
                             string)` alongside the existing
                             `beginEdit()` path. The first option
                             initializes the editor state with
                             `value: initialValue` (replaces prior);
                             the second initializes with the cell's
                             current value (prefill).
    useGridSelection.ts      UNCHANGED.
  components/
    InlineCellEditor.tsx     UNCHANGED — accepts `value` prop and
                             renders it; doesn't care whether it
                             came from "prior cell value" or "typed
                             char."
```

### 4.2 Keyboard handler sketch

```ts
// useGridKeyboard.ts — printable-char branch
if (
  event.key.length === 1 &&
  !event.metaKey && !event.ctrlKey && !event.altKey &&
  selection.activeCell !== null &&
  selection.isSingleCell &&  // helper derived from normalizedRange
  !readOnly &&
  !isCellReadOnly(selection.activeCell) &&
  !isSingleSelectColumn(selection.activeCell) && // routes via plan 05
  !edit.editing
) {
  event.preventDefault();
  onTypeToEdit(event.key);
  return;
}

// Backspace / Delete: same conditions, initialValue = ""
if (
  (event.key === "Backspace" || event.key === "Delete") &&
  !event.metaKey && !event.ctrlKey && !event.altKey &&
  selection.activeCell !== null &&
  selection.isSingleCell &&
  !readOnly &&
  !isCellReadOnly(selection.activeCell) &&
  !edit.editing
) {
  event.preventDefault();
  onTypeToEdit("");
  return;
}
```

`DataTable.tsx` wires `onTypeToEdit` to
`useGridEdit.beginEditWith(initialValue)`.

### 4.3 Edit state machine extension

```ts
// useGridEdit.ts
type EditState =
  | null
  | { kind: "prefill"; cellAddress: CellAddress; value: string }
  | { kind: "replace"; cellAddress: CellAddress; value: string };

function beginEdit(cellAddress: CellAddress, currentValue: string) {
  setEdit({ kind: "prefill", cellAddress, value: currentValue });
}

function beginEditWith(cellAddress: CellAddress, initialValue: string) {
  setEdit({ kind: "replace", cellAddress, value: initialValue });
}
```

The `kind` distinction is internal — the editor renders the same
`<input>` either way. It exists for future debugging / analytics and
because some commit logic may want to know whether the user replaced
or edited (e.g., "user typed N chars" telemetry).

### 4.4 Test plan

- **`useGridKeyboard.test.ts`** (extensions):
  - Printable char on single active cell calls `onTypeToEdit(key)`.
  - Same key with ⌘ held does NOT call `onTypeToEdit`.
  - Same key with multi-cell selection does NOT call.
  - Same key on a read-only column does NOT call.
  - Backspace / Delete on single active cell calls `onTypeToEdit("")`.
  - Arrow keys still navigate (no regression).
- **`useGridEdit.test.ts`** (extensions):
  - `beginEditWith(addr, "K")` sets state to `{kind: "replace",
    value: "K"}`.
  - `beginEdit(addr, "Bedroom")` sets state to `{kind: "prefill",
    value: "Bedroom"}`.
  - Commit calls `onWrite` with the editor's final value regardless
    of `kind`.
- **`DataTable.test.tsx`** (extensions):
  - Type-to-edit end-to-end: focus active cell, simulate `keydown
    "K"`, assert editor mounts with `value: "K"`.
  - Type-to-edit blocked on multi-cell: simulate keydown after
    multi-cell selection → no editor mount.
  - F2 still opens editor with prior value.
  - Enter still opens editor with prior value.

## 5. Execution order

Three steps. Tree green after each.

### Step 1 — Read current edit + keyboard wiring

- Read `useGridKeyboard.ts` to find where Enter / F2 are handled
  (or confirm they're not yet wired — Phase 1 should have).
- Read `useGridEdit.ts` to find the existing `beginEdit` entry
  point.
- Confirm `useGridSelection` exposes `isSingleCell` (or equivalent)
  — if not, add a small derived getter.

### Step 2 — Edit state machine extension

- Add `beginEditWith(addr, initialValue)` to `useGridEdit.ts` per
  §4.3.
- Confirm Enter / F2 route to `beginEdit` (prefill path); add
  routing if missing.
- Tests: extend `useGridEdit.test.ts`.
- Commit: `feat(data-table): beginEditWith for type-to-replace`.

### Step 3 — Keyboard handler + DataTable wiring

- Extend `useGridKeyboard.ts` per §4.2.
- Wire `DataTable.tsx` to pass `onTypeToEdit` callback.
- Tests: extend `useGridKeyboard.test.ts`, `DataTable.test.tsx`.
- `make typecheck && make lint && make test`.
- `make dev`, walk §10.
- Commit: `feat(data-table): type-to-edit on active cell (AirTable
  parity)`.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `event.key.length === 1` matches some dead-key composition characters that should not commit a value. | Modern browsers handle IME composition via `compositionstart` / `compositionend` events; the keydown for a dead key has `event.isComposing === true`. Add a guard: `&& !event.isComposing`. |
| Typing `d` while a multi-cell selection is active is a user expectation that nothing happens — but if the announce-region fires every time, it becomes noisy. | Announce only on the *first* blocked typing event per selection-change (use a ref similar to Phase 7's `hasAnnouncedClamp`). After the announce, subsequent ignored chars are silent. Reset the flag whenever the selection changes. |
| F2 / Enter aren't wired to open the editor today. (Need to confirm in Step 1.) | If they're not wired, this plan adds them in Step 2's commit. The work is small — one switch arm in the keyboard hook calling `beginEdit(activeCell, currentValue)`. |
| Single-select cells need different routing (plan 05). If plan 05 hasn't landed, this plan's `isSingleSelectColumn` guard blocks the typing path for those cells — they'd remain un-editable via typing until plan 05. | Acceptable: plan 05 is sequenced immediately after this one. Until then, single-select cells still respond to double-click (current behavior). Documented in §7. |
| Backspace clearing the cell on the active cell is destructive — a user might press it expecting Backspace-to-navigate-back behavior (no app has that, but they might). | The clear happens via `beginEditWith("")`, which enters edit mode with empty value but does NOT commit until Enter. The user can press Escape to cancel without losing the prior value. Matches Excel. |
| `isCellReadOnly(activeCell)` requires looking up the column's `readOnly` flag — needs the field-def map in scope of the keyboard hook. | The hook already receives `fieldDefByKey` (Phase 4); add a helper that consults it. |
| Type-to-edit competes with browser default for keys like `/` (Firefox quick-find) or `'` (Caret browsing). | `event.preventDefault()` is called before dispatch — blocks browser default. Phase 7 established this same pattern for ⌘D / ⌘R. |

## 7. What this plan explicitly does not do

- Does not handle single-select cells — plan 05 owns that routing.
- Does not change double-click behavior.
- Does not add a keyboard-driven multi-cell paste alternative (the
  existing paste primitive serves that).
- Does not change the editor's commit / cancel / blur semantics.
- Does not handle IME composition (the `!isComposing` guard
  excludes the path entirely; full IME support is a separate
  story).
- Does not handle "type to filter" (some grid libraries use typing
  to filter rows when no cell is active). Out of scope.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — read current edit + keyboard wiring | 0.3 | 0.5 |
| 2 — edit state machine extension     | 0.5 | 1.0 |
| 3 — keyboard handler + DataTable     | 1.0 | 1.5 |
| **Total**                            | **1.8** | **3.0** |

Under half a workday.

## 9. Commit plan

1. `feat(data-table): beginEditWith for type-to-replace`
2. `feat(data-table): type-to-edit on active cell (AirTable
   parity)`

## 10. Demo script

1. `make dev`, open Rooms with several rows.
2. Click row 3 `name` (cell becomes active). Press `K`. Editor
   opens with value `"K"`. Type `itchen`. Press Enter. Cell shows
   `"Kitchen"`.
3. Click row 4 `num_people` (active). Press `5`. Editor shows
   `"5"`. Enter commits 5.
4. Click row 3 `name` (now "Kitchen"). Press F2. Editor shows
   `"Kitchen"` with cursor at end. Type ` 2`. Enter commits
   `"Kitchen 2"`.
5. Same cell. Press Enter. Editor shows `"Kitchen 2"` with cursor
   at end (Excel-style). Press Escape to cancel.
6. Same cell. Double-click. Editor shows `"Kitchen 2"` (prefill).
   Escape.
7. Same cell. Press Backspace. Editor opens empty. Type
   `"Kitchen 3"`. Enter commits.
8. Select rows 3–5 on `name` (multi-cell). Press `K`. Nothing
   happens; first time triggers announce. Press `i` — silent (no
   re-announce). Move selection to single cell; type now works
   again.
9. Active cell on a read-only column. Press `K`. Announce: `This
   cell is read-only.`. No editor opens.
10. Press ⌘D, ⌘C, ⌘Z — all still work (modifier check passes).
11. Arrow keys still navigate.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — read current edit + keyboard wiring | | | |
| 2 — edit state machine extension     | | | |
| 3 — keyboard handler + DataTable     | | | |
| Plan 04 overall                      | | | |
