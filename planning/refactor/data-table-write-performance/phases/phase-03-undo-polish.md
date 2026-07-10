---
DATE: 2026-07-09
TIME: -
STATUS: Planned — depends on phase-01; phase-02 makes undo feel
  instant but is not a hard dependency.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 3 — make the existing
  ⌘Z/⌘⇧Z infrastructure reliable and useful: capacity, safety
  (clear-on-invalidation), queue routing, and verified per-op-kind
  inverse coverage. No new undo architecture.
RELATED:
  - ../PRD.md §2 (F-8), §6 (D-6, D-8), §7 (A-4), §8 (R-3)
  - frontend/src/shared/ui/data-table/hooks/useGridHistory.ts (capacity 8 today)
  - frontend/src/shared/ui/data-table/hooks/useGridWriteReducer.ts (undoOnce/redoOnce)
  - frontend/src/shared/ui/data-table/hooks/useGridKeyboard.ts:113-119 (⌘Z bindings)
  - frontend/src/shared/ui/data-table/DataTable.tsx:912-919 (wiring), :591-666 (insertRowBelow inverse)
  - frontend/src/shared/ui/data-table/__tests__/useGridHistory.test.ts (existing coverage)
---

# Phase 3 — Undo/redo polish

## 1. Goal

⌘Z is trustworthy for the S-3 basket — cell write, clear, paste, fill,
row insert/delete/duplicate — at realistic depth, at typing speed, and
never applies an inverse against a base it wasn't captured on.

Explicitly NOT the goal: cross-mount persistence, cross-table undo,
schema-mutation undo guarantees (nice if already working; don't chase).

## 2. Work items

### 2.1 Capacity (D-8)

`DEFAULT_CAPACITY` 8 → **50** in `useGridHistory.ts:21`. Entries are
small (`WriteOp` pairs, worst case a paste's `CellWrite[]`); 50 is
still trivial memory. Keep the trim-oldest behavior.

### 2.2 Safety: clear history whenever the base is invalidated (D-6)

History inverses are only valid against the slice lineage they were
captured on. Call `history.clear()` on every event that replaces that
lineage outside the queue's own acks:

- write-failure drain (wired in Phase 1/2 — verify, don't duplicate),
- `handleStaleDraftConflict` / `reloadDraft` / `handleVersionLockedConflict`,
- remote broadcast slice application (Rooms `onRemoteSlice`),
- version switch (already: verify the existing `clear` call sites).

Deliverable: one table in the PR listing every lineage-replacing event
and its clear call site. (This resolves R-3 for the v1 bar.)

### 2.3 Route undo/redo replays through the dispatch queue

`undoOnce`/`redoOnce` (`useGridWriteReducer.ts:49-61`) call `onWrite`
directly — after Phase 1 that already lands in the queue. Verify, and
add the missing piece: a ⌘Z **burst** must serialize stack-pops too
(today each pop is synchronous but the replay is async — 5 rapid pops
enqueue 5 replays; confirm pops and replays stay paired under failure:
a drained replay must NOT leave the entry stranded on the redo stack
as if it succeeded). Simplest contract: on any replay failure, clear
both stacks (consistent with 2.2).

### 2.4 Inverse-coverage verification per op kind

Write one parameterized test per `WriteOp` kind asserting
round-trip: apply op → apply inverse → slice deep-equals original.
Sources of the inverses to verify (all exist today — this is
verification, not construction):

- cell / clear → inverse `cell` with prior values (from `useGridEdit`)
- paste → inverse carrying `rowsDeleted` for inserted rows + prior cell
  values + `removedOptions` for options the paste created
- fill → inverse `fill`/`cell` with prior values
- rowInsert → inverse `rowDelete` (tmp id) — verify the id the server
  kept matches the id the inverse targets (rows are client-id'd; if
  the backend ever rewrites ids this breaks — confirm it doesn't)
- rowDelete → inverse `rowInsert` carrying the full row snapshot —
  verify linked-record cleanup cascades (e.g. Rooms↔Ventilators) are
  captured or explicitly documented as not-undoable
- rowDuplicate → inverse `rowDelete` (uses `sourceRow` snapshot per
  types.ts:334-337)

Any kind that fails round-trip: fix the inverse construction at its
gesture site, or (if genuinely hard, e.g. cross-table cascade) exclude
the kind from history with a code comment + PRD amendment — never leave
a silently-wrong inverse.

### 2.5 Keyboard/UX details

- ⌘Z while a cell editor is open: confirm the editor's native input
  undo is not shadowed (grid-level ⌘Z should apply only when the grid,
  not the editor input, has focus — check `useGridKeyboard` gating and
  `focusGrid()` post-commit flow, DataTable.tsx:518).
- Windows/Linux: verify Ctrl+Z is bound wherever ⌘Z is (check the
  modifier handling in `useGridKeyboard.ts:113`).
- Optional, cheap, do it: aria-announce "Undid <kind>" via the existing
  `setAnnounce` channel so undo has non-visual feedback.

## 3. Step-by-step

1. Capacity bump + existing-test updates.
2. Lineage-clear audit + wiring + table (2.2).
3. Burst-safety on undo/redo replay failure (2.3).
4. Per-kind round-trip suite (2.4); fix or exclude failures.
5. Keyboard audit (2.5).
6. Playwright: A-4 — edit 6 cells fast, ⌘Z ×6 fast, assert original
   values server-side; then ⌘⇧Z ×3, assert replay; then a paste and a
   row insert/delete each undone.
7. Closeout gate.

## 4. Acceptance

- PRD A-4 verbatim, plus: undo burst during in-flight forward writes
  (type, type, ⌘Z immediately) neither errors nor interleaves out of
  order (queue guarantees ordering; test proves it).

## 5. Notes

- Keep history per-table even if the queue is per-draft: a ⌘Z in the
  Rooms table must not undo a Ventilators edit. (History lives in the
  DataTable instance already — just don't "fix" that while touching
  capacity.)
- Do not grow scope into persistent/durable undo; NG-3.
