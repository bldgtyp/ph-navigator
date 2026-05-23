---
DATE: 2026-05-23
TIME: planning
STATUS: Draft implementation plan — awaiting Ed approval.
SCOPE: Phase 0 of the `<DataTable>` AirTable-parity plan. Internal-only
       refactor of `frontend/src/shared/ui/data-table/`. Zero new
       user-visible features. Establishes the architecture later phases
       plug into.
PARENT-PLAN: docs/plans/2026-05-23/datatable-airtable-parity.md
RELATED:
  - context/technical-requirements/data-table.md (canonical contract)
  - research/poc-plans/poc-lessons-for-real-build.md
    (L1.1, L5.2, L5.3, L6.1, L6.2, L6.3, L7.1)
---

# Phase 0 — Foundation Refactor

## 1. Why this phase exists

`DataTable.tsx` is 523 LOC with cell-render markup, keyboard nav,
selection state, inline-edit lifecycle, clipboard wiring, and toolbar UI
all interleaved. Phases 1–7 each add a behavior that needs to plug into
one of those concerns:

- Phase 1 (inline edit + popover) needs an edit-lifecycle hook.
- Phase 2 (row insert/delete + undo) needs a write reducer and history.
- Phase 3 (mouse-drag selection) needs a selection controller separable
  from keyboard nav.
- Phase 4 (filter/sort toolbar) needs `ViewState` mutations to flow
  through one channel.
- Phase 6 (tints) needs cell rendering to consume role state from a
  single derived map.
- Phase 7 (fill handle) needs the selection controller to expose a
  `fill` mode (PoC L7.1).

Doing those phases against today's monolith means each one untangles a
slice of the same knot. Phase 0 untangles the knot once, with no
behavior changes, so every later phase is a focused addition.

## 2. Binding constraints

1. **Zero behavior change.** Rooms (US-EQ-2) must render byte-identically
   before and after. Every existing test in `DataTable.test.tsx` and
   `lib.test.ts` must pass with at most mechanical updates (selection
   shape — see §4.4).
2. **No new dependencies.** Phase 0 is pure refactor; `@dnd-kit/sortable`
   etc. lands in later phases.
3. **No consumer file edits.** `frontend/src/features/equipment/` must
   not change. If a Rooms file needs to change, the refactor has leaked
   beyond the primitive — pause and reconsider.
4. **Stable row-id is canonical (L1.1).** The most important durable
   change in this phase. Visual indices are translation-layer only.
5. **One write primitive (L6.1).** Even though Phase 0 adds no new
   gestures, the existing inline-edit and paste paths route through a
   new shared reducer; the history stack records them as semantic ops
   (L6.2) so Phase 1+ inherits a working undo backbone.
6. **In-memory undo, cleared on rows-identity change (L6.3).** No
   server-conflict story in this phase.

## 3. Acceptance criteria

This is what "Phase 0 demo passed" means. All eleven must be true.

1. `pnpm run dev`, navigate to a project's Rooms sub-tab. Everything
   that worked before still works: click-to-focus, arrow nav,
   double-click to edit text/number, Enter/Esc edit lifecycle,
   Tab/Shift-Tab, Home/End, ⌘A, ⌘C, ⌘V (with a write handler),
   Shift+Arrow extend, row-gutter click selects row, header click
   toggles sort, single text-filter rule still filters.
2. The existing **9 tests** in `DataTable.test.tsx` pass — updated only
   if they assert on the now-removed visual-index selection shape.
3. The existing **lib.ts tests** (`lib.test.ts`) pass unchanged. Pure
   helpers (`normalizeRange`, `moveActiveCell`, `parseTsv`, `planPaste`,
   `coerceFieldValue`, `applyTextFilters`, `sortRows`, etc.) are not
   touched in Phase 0.
4. New unit tests cover the **history reducer**: every `onWrite` push
   creates exactly one history entry; the entry is the semantic
   `WriteOp` (not per-cell deltas); history is cleared when the `rows`
   reference identity changes.
5. New unit tests cover the **selection controller**: arrow extension,
   ⌘A, row-gutter selection, and that selection survives a `rows` patch
   that preserves row ids but changes their indices (the L1.1 proof).
6. `DataTable.tsx` is **≤ 200 LOC**. Anything beyond shell composition
   has been moved into a hook or sub-component.
7. **Type surface is unchanged** (`types.ts` may gain `default?: unknown`
   on `FieldDef` as a forward-compatible nullable, but the existing
   exports keep the same shape). No `DataTableProps` field renames.
8. `make typecheck`, `make lint`, `make test`, `make format` all clean.
9. `RoomsTable.tsx` and every other file outside
   `frontend/src/shared/ui/data-table/` are unchanged.
10. **In a Rooms session**: edit a name cell, ⌘Z reverts it. Paste a TSV
    block (with `onWrite` wired), ⌘Z reverts the whole paste as one op.
    This proves the history backbone works even though Phase 0 doesn't
    expose an undo button — ⌘Z is the only surfaced affordance and the
    test is internal-only.
11. **History clears on identity change**: in a Rooms session, edit a
    cell (history has 1 entry); switch to another sub-tab and back
    (which remounts with a new `rows` array); ⌘Z does nothing — the
    history was cleared.

## 4. Target architecture

### 4.1 File layout (after)

```
frontend/src/shared/ui/data-table/
  DataTable.tsx              shell + composition only (≤ 200 LOC)
  components/
    GridHeader.tsx           thead rendering + sort affordance
    GridBody.tsx             tbody rendering + cell hit-targets
    GridGutter.tsx           row-number / row-select gutter cells
    InlineCellEditor.tsx     existing inline <input> overlay
  hooks/
    useGridSelection.ts      anchor/focus + range geometry + keyboard
                             extension. Phase 3 adds drag mode; Phase 7
                             adds fill mode.
    useGridKeyboard.ts       arrow/Tab/Home/End/⌘A/⌘C/⌘V/Enter/Esc
                             dispatch. Calls into selection / edit /
                             history hooks.
    useGridEdit.ts           inline edit lifecycle (start / draft /
                             commit / cancel). Phase 1 generalizes for
                             single-select popover.
    useGridHistory.ts        in-memory 8-deep undo stack. push / undo /
                             redo / clear. Phase 0 wires ⌘Z / ⌘⇧Z.
    useGridWriteReducer.ts   the one chokepoint. Accepts a WriteOp,
                             pushes to history, calls onWrite.
  lib.ts                     existing pure helpers — UNCHANGED in Phase 0
  types.ts                   forward-compat tweaks only (§4.3)
  index.ts                   public exports — UNCHANGED in Phase 0
  __tests__/
    DataTable.test.tsx       existing 9 tests, lightly updated
    lib.test.ts              UNCHANGED
    useGridSelection.test.ts NEW
    useGridHistory.test.ts   NEW
    useGridWriteReducer.test.ts NEW
```

Note: Phase 0 introduces `components/` and `hooks/` and `__tests__/`
subdirectories. The existing tests move into `__tests__/` (one git
rename). The existing `DataTable.tsx` and `lib.ts` keep their paths so
import sites outside the module don't break.

### 4.2 Hook contracts

Each hook is a typed React hook that owns one concern and exposes a
minimal surface. The `<DataTable>` shell composes them.

**`useGridSelection`** owns range geometry and keyboard extension.
Phase 0 surface:

```ts
type GridSelectionState = {
  // Stable identity — L1.1.
  anchor: { rowId: string; fieldKey: string } | null;
  focus:  { rowId: string; fieldKey: string } | null;
};

type GridSelection = {
  state: GridSelectionState;
  // Visual projection — derived once per render from the current
  // rowId/fieldKey lists.
  normalizedRange: NormalizedRange | null;
  activeCell: CellCoord | null;

  // Imperative API the keyboard hook calls into.
  setActive: (cell: { rowId: string; fieldKey: string } | null) => void;
  extendTo: (cell: { rowId: string; fieldKey: string }) => void;
  collapse: () => void;
  selectRow: (rowId: string) => void;
  selectAll: () => void;
  moveBy: (delta: KeyMove) => void; // ArrowUp / ArrowDown / Home / End / etc.
};

function useGridSelection(args: {
  rowIds: string[];
  fieldKeys: string[];
}): GridSelection;
```

Why row-id + field-key: surviving sort/filter/refetch is the durable
property (L1.1). The hook owns the visual-index translation internally
and exposes only stable ids to the rest of the system. The
`normalizedRange` projection is what `<GridBody>` reads for cell-class
decisions.

**`useGridHistory`** is a tiny stack.

```ts
type HistoryEntry =
  | { op: WriteOp; inverse: WriteOp };

type GridHistory = {
  push: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

function useGridHistory(opts?: { capacity?: number }): GridHistory;
```

Defaults: `capacity = 8` (PoC value). The hook clears on a top-level
identity change of the `rows` prop, but the *trigger* lives in the
shell — the hook itself just exposes `clear()`.

**`useGridWriteReducer`** is the one chokepoint.

```ts
type DispatchWrite = (
  op: WriteOp,
  inverse: WriteOp,
) => Promise<void> | void;

function useGridWriteReducer(args: {
  history: GridHistory;
  onWrite?: (op: WriteOp) => void | Promise<void>;
}): { dispatchWrite: DispatchWrite };
```

The caller (always one of `useGridEdit`, the paste path, later
`useGridFill`, etc.) provides both `op` and `inverse`. The reducer
pushes the entry and forwards `op` to the consumer's `onWrite`. Phase 0
inverses:

- inline `cell` write: inverse is a `cell` op with the previous value.
- paste: inverse is a `cell` op writing each cell's pre-paste value
  (paste-with-row-insert lands in Phase 2; for Phase 0 the inverse is
  cell-only).

`undo()` re-runs `dispatchWrite` with the inverse op but flagged so it
doesn't re-push to history (it moves to the redo stack).

**`useGridEdit`** owns inline edit lifecycle. Phase 0 keeps the existing
behavior (double-click to start, blur cancels, Enter commits, Tab
commits-and-moves) — but routes commit through `dispatchWrite`.

```ts
type GridEdit = {
  editing: {
    rowId: string;
    fieldKey: string;
    draftValue: string;
    originalValue: unknown;
  } | null;
  start: (args: { rowId: string; fieldKey: string; row: TRow }) => void;
  draft: (value: string) => void;
  commit: () => Promise<boolean>;
  cancel: () => void;
};
```

**`useGridKeyboard`** is the dispatcher. Phase 0 surface:

```ts
function useGridKeyboard(args: {
  selection: GridSelection;
  edit: GridEdit;
  history: GridHistory;
  onCopy: () => void;
  onPaste: () => void;
  onRowOpen?: (rowId: string) => void;
  readOnly: boolean;
  isGrouped: boolean;
}): {
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
};
```

This is the only hook that touches DOM events directly. Everything else
is reducer-shaped.

### 4.3 Type changes

`types.ts` gets one forward-compat addition; nothing existing breaks.

```ts
// Already present, unchanged:
export type FieldDef = { ... };

// New optional slot, prepared for Phase 2 row-insert default values.
// Defaults to undefined, treated as the field type's natural zero
// (text: "", number: null, single_select: null).
export type FieldDef = {
  // ... existing fields
  default?: unknown;
};
```

Public exports in `index.ts` are unchanged. The hooks are internal —
they live in `hooks/` and are not exported from the barrel. If a future
phase wants to expose one, that's a deliberate API decision then.

### 4.4 Test migration

`DataTable.test.tsx` has 9 tests. Six of them assert on user-visible
behavior (paste announce text, read-only paste, write payloads, filter
empty state, tab-order, inline edit commit text). Three of them are
sensitive to the selection model shape but only via the `onWrite`
payload (which uses `rowId` / `fieldKey` — already stable identity).
**Expected outcome: 0 test rewrites needed.** If any test fails after
the refactor, that's a behavior bug and the refactor needs fixing.

New tests added:

- `useGridSelection.test.ts`:
  - Arrow extension changes focus only when Shift is held.
  - ⌘A produces a range from (rowIds[0], fieldKeys[0]) to
    (last, last).
  - Selection survives a `rows` patch that re-orders rows but keeps
    the same ids — the L1.1 invariant.
  - Selection collapses when the anchor row is removed from `rowIds`.

- `useGridHistory.test.ts`:
  - Push adds an entry; capacity of 8 evicts the oldest on overflow.
  - Push clears the redo stack.
  - `clear()` empties both stacks.

- `useGridWriteReducer.test.ts`:
  - `dispatchWrite` calls `onWrite(op)` and pushes the entry.
  - Undo calls `onWrite(inverse)` and does NOT push another entry.
  - Redo calls `onWrite(op)` again and does NOT push.
  - When `onWrite` rejects, history is rolled back to the prior state.

### 4.5 Render pipeline (shape after refactor)

```
DataTable
├── (top) useGridSelection      ← consumes rowIds, fieldKeys derived
├──       useGridHistory             from props
├──       useGridWriteReducer
├──       useGridEdit
├──       useGridKeyboard
│
├── <div role="grid" onKeyDown={kb.onKeyDown}>
│     <GridHeader columns sort onToggleSort />
│     <GridBody
│        rows
│        columns
│        normalizedRange={sel.normalizedRange}
│        activeCell={sel.activeCell}
│        editing={edit.editing}
│        onCellClick={(rowId, fieldKey) => sel.setActive({rowId, fieldKey})}
│        onCellDoubleClick={(rowId, fieldKey) => edit.start(...)}
│        renderEditor={(...) => <InlineCellEditor ... />}
│     />
│   </div>
```

`<DataTable>` itself becomes orchestration: derive `rowIds` and
`fieldKeys` once per render, wire hooks, pass slices to `<GridHeader>`
and `<GridBody>`.

## 5. Execution order

Six steps. Each leaves the tree in a working state — `make test`
green at every checkpoint.

### Step 1 — Extract `useGridHistory` + `useGridWriteReducer`

- Create `hooks/useGridHistory.ts` and `hooks/useGridWriteReducer.ts`
  with their unit tests.
- In `DataTable.tsx`, replace the existing direct `onWrite(...)` calls
  in `commitInlineEdit` and `pasteIntoSelection` with
  `dispatchWrite(op, inverse)`.
- Wire `⌘Z` / `⌘⇧Z` to `history.undo()` / `history.redo()` in
  `handleKeyDown` (only when `!editing` and `!readOnly`).
- Wire a `useEffect(() => history.clear(), [rows])` to clear history
  on rows-identity change.
- All existing tests must still pass; the new history/reducer tests
  pass.

### Step 2 — Extract `useGridSelection`

- Create `hooks/useGridSelection.ts` exposing the row-id / field-key
  shape from §4.2.
- Inside the hook, derive index lookups from `rowIds` / `fieldKeys`
  via `useMemo`.
- In `DataTable.tsx`, replace the local `activeCell` / `selection`
  state with `useGridSelection({rowIds, fieldKeys})`.
- All `setActiveCell` / `setSelection` call sites become `sel.setActive`
  / `sel.extendTo` / `sel.collapse`.
- The render paths that previously consumed `activeCell` /
  `normalizedActiveRange` now consume `sel.activeCell` /
  `sel.normalizedRange`. Indices are translated inside the hook.

### Step 3 — Extract `useGridEdit`

- Create `hooks/useGridEdit.ts`. Move the `EditingCell` type and the
  start/draft/commit/cancel logic out of `DataTable.tsx`.
- The hook accepts `dispatchWrite`, `fieldDefByKey`, `onAnnounce`, and
  `onRowOpen` as args.
- `<InlineCellEditor>` moves to `components/InlineCellEditor.tsx`.
- The shell now renders the editor when
  `edit.editing?.rowId === rowId && edit.editing.fieldKey === fieldKey`.

### Step 4 — Extract `useGridKeyboard`

- Create `hooks/useGridKeyboard.ts`. Move every arm of `handleKeyDown`
  into it. The hook returns `{ onKeyDown }`.
- `<DataTable>` wires it as
  `<div onKeyDown={kb.onKeyDown}>`.

### Step 5 — Extract `<GridHeader>` / `<GridBody>` / `<GridGutter>`

- Pure-presentational sub-components. They receive the data they
  display + minimal callbacks. No state of their own.
- `<DataTable>` is now under 200 LOC.

### Step 6 — Move tests into `__tests__/`, run the full demo

- `git mv` the two existing tests under `__tests__/`. New tests live
  there too.
- Run `make typecheck`, `make lint`, `make test`, `make format`.
- Run `pnpm run dev`, walk the §3 acceptance checklist on Rooms.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Hidden coupling between selection state and edit lifecycle (clicking a cell while another is editing). | Step 3 explicitly tests "blur commits, click elsewhere cancels" — the existing test `does not paste in read-only mode` and `commits inline edits on Tab` already cover the wiring. If they fail, fix before moving on. |
| `useEffect(history.clear(), [rows])` over-triggers if a parent passes a freshly-allocated `rows` array on every render. | Clarify in the hook doc: clearing is identity-based; consumer pages must memoize `rows` if they synthesize it. RoomsTable already does (line ~76 in `RoomsTable.tsx`, via `sortedRooms`). Add a unit test that confirms two distinct `[r1, r2]` arrays with the same row ids trigger a clear — that's the conservative behavior and matches PoC L6.3. |
| `useGridSelection`'s row-id translation has a perf cost on every keystroke. | Index lookups are `Map` reads built once per render via `useMemo`. ~50 ns per access; negligible at Rooms scale. Flag for re-measurement at 10 k+ in a later phase. |
| The 9 existing tests rely on visible row indices via DOM structure (`screen.getByText("Living Room")`). | These keep working — DOM rendering is unchanged. Only the `onWrite` payload assertions matter, and those use `rowId` already. |
| Splitting `DataTable.tsx` mid-refactor leaves a transient state where `make test` fails. | Execute steps in the order in §5. Each step is a complete checkpoint with green tests. Commit per step (6 commits) rather than one big-bang commit. |
| `useGridKeyboard` becomes a god-hook because it touches everything. | That's intentional. It is the dispatch layer; the work happens elsewhere. If it grows past ~150 LOC during a later phase, split by gesture family (selection keys vs. write keys vs. clipboard keys). |

## 7. What this phase explicitly does not do

- No new user-visible behavior. No new gestures. No new field types.
- No persistence work. No backend changes. No new endpoints.
- No `@dnd-kit/sortable` or any new dependency.
- No tint palette, no popovers, no side-panel scaffold, no fill handle.
- No public API change to `<DataTable>` props or exports.
- No consumer file changes (Rooms, future tables stay untouched).

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — history + write reducer | 1.5 | 2.5 |
| 2 — selection (incl. L1.1 stable-id migration) | 2.0 | 3.0 |
| 3 — edit lifecycle | 1.0 | 1.5 |
| 4 — keyboard dispatch | 1.0 | 1.5 |
| 5 — body / header / gutter split | 0.5 | 1.0 |
| 6 — test relocation + acceptance walk | 0.5 | 0.5 |
| **Total** | **6.5** | **10.0** |

Matches the parent plan's 6–10 evening hours.

## 9. Commit plan

One commit per step. Each commit message follows the
`refactor(data-table): ...` shape, with a one-line body summarizing
which file moves / hooks land in that commit, and a `Co-Authored-By:`
trailer when the work is paired.

After Step 6, a single follow-up commit can include any small cleanups
(JSDoc on the hooks, README in `shared/ui/data-table/`) if Ed wants
them — otherwise close the phase.

## 10. Demo script (the §3 acceptance walk, expanded)

When Phase 0 is "done", Ed walks this script in a real browser and
verifies every step. Record pass/fail in §11.

1. `make dev` brings Postgres up; `make backend` + `make frontend`
   start the stack.
2. Sign in, open any project, navigate to Equipment → Rooms.
3. Click any cell — focus border appears, no behavior change.
4. Arrow around — focus moves; out-of-viewport cells scroll into
   view as before.
5. Tab / Shift-Tab — wraps across columns, advances rows at the end.
6. Home / End — jumps to first / last column.
7. ⌘A — entire visible table selected.
8. ⌘C — TSV copied; paste into a text editor; verify the row × column
   block.
9. Double-click a number cell, type a new value, Enter — value
   commits, "Count updated." announce fires.
10. Double-click a text cell, Esc — edit cancels.
11. Click row-gutter number — entire row highlighted.
12. **New:** Edit a cell, ⌘Z — value reverts.
13. **New:** Click out, navigate to another sub-tab, come back; ⌘Z
    does nothing (history was cleared by rows-identity change).
14. With a paste handler wired (the existing keydown path), ⌘V on a
    selection — paste lands; ⌘Z reverts the paste as one op.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — history + write reducer | — | — | — |
| 2 — selection (L1.1) | — | — | — |
| 3 — edit lifecycle | — | — | — |
| 4 — keyboard dispatch | — | — | — |
| 5 — body / header / gutter | — | — | — |
| 6 — tests + acceptance walk | — | — | — |
| Phase 0 overall | — | — | — |
