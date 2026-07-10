---
DATE: 2026-07-09
TIME: -
STATUS: Complete — implemented and verified 2026-07-09.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 4 — make the existing ⌘Z/⌘⇧Z
  infrastructure reliable: capacity, lineage-clear safety, burst-safe
  replay through the coordinator, verified per-op-kind inverse
  coverage. No new undo architecture. Canonical contract: undo is
  local-only; no compensating requests after a conflict.
RELATED:
  - ../PRD.md §3 (F-8), §7 (D-6, D-8), §8 (A-4), §9 (R-C)
  - ../plan-review.md §5 step 5
  - context/technical-requirements/data-table.md:523-528
  - frontend/src/shared/ui/data-table/hooks/useGridHistory.ts (capacity 8 today)
  - frontend/src/shared/ui/data-table/hooks/useGridWriteReducer.ts (undoOnce/redoOnce)
  - frontend/src/shared/ui/data-table/hooks/useGridKeyboard.ts:113-119 · DataTable.tsx:912-919, :591-666
---

# Phase 4 — Undo/redo polish

## 1. Goal

⌘Z is trustworthy for the S-3 basket — cell write, clear, paste, fill,
row insert/delete/duplicate — at realistic depth, at typing speed, and
never applies an inverse against a base it wasn't captured on.

NOT the goal: cross-mount persistence, cross-table undo,
schema-mutation undo guarantees (fine if already working; don't chase).

## 2. Work items

### 2.1 Capacity (D-8)

`DEFAULT_CAPACITY` 8 → **50** (`useGridHistory.ts:21`). Keep
trim-oldest.

### 2.2 Lineage-clear audit (D-6 / R-C)

Inverses are valid only against the slice lineage they were captured
on. `history.clear()` must fire on every lineage-replacing event —
verify the ones phases 01/02 wired (failure drain, rollback) and add
the rest:

- `handleStaleDraftConflict` / `reloadDraft` / version-locked path,
- remote broadcast slice application (Rooms `onRemoteSlice`),
- version switch, discard, controller unmount (trivially — history is
  mount-local; verify no stale-ref leak).

Deliverable: a table in the PR listing every lineage-replacing event →
its clear call site.

### 2.3 Burst-safe replay pairing

`undoOnce`/`redoOnce` (`useGridWriteReducer.ts:49-61`) pop
synchronously, then replay via `onWrite` (already coordinated after
phase-01; instant after phase-02). The gap: a ⌘Z burst pops 5 entries
whose replays settle later — a replay failure must NOT leave popped
entries stranded on the redo stack as if they succeeded. Contract: any
replay settle-failure → clear both stacks (consistent with 2.2; the
drain already invalidated the lineage). Under phase-02, replays get
optimistic-accept like any op — pops and accepts stay 1:1; test the
failure interleaving explicitly.

### 2.4 Inverse-coverage round-trip tests

Parameterized per `WriteOp` kind, across all tables via the shared
contract suite: `applyOps(applyOps(slice, op), inverse) ≡ slice`
(using the phase-02 applier as the oracle):

- cell / clear → inverse cell with prior values
- paste → inverse: rowsDeleted for inserted rows + prior cell values +
  removedOptions for paste-created options
- fill → inverse fill/cell with prior values
- rowInsert → inverse rowDelete (client-generated id is permanent —
  assert the backend never rewrites row ids)
- rowDelete → inverse rowInsert with the full row snapshot; document
  (not necessarily fix) cross-table cascade behavior — e.g. the
  Rooms↔Ventilators link cleanup: if a room delete cleared a link on
  another table, undo of the delete does NOT restore the other table's
  link unless the inverse captured it. If not captured: excluded-kinds
  comment + PRD note, never a silently-wrong inverse.
- rowDuplicate → inverse rowDelete via `sourceRow` snapshot
  (types.ts:334-337)

Failures: fix the inverse construction at its gesture site, or exclude
the kind from history with a code comment + PRD amendment.

### 2.5 Keyboard/UX

- ⌘Z with an open cell editor: native input undo must not be shadowed
  (grid-level ⌘Z only when the grid has focus — check `useGridKeyboard`
  gating + `focusGrid()` flow, DataTable.tsx:518).
- Verify Ctrl+Z parity for Windows/Linux in `useGridKeyboard.ts:113`.
- Cheap and worth it: aria-announce "Undid <kind>" via the existing
  `setAnnounce` channel.

## 3. Step-by-step

1. Capacity bump + test updates.
2. Lineage-clear audit + wiring + PR table (2.2).
3. Burst pairing contract + failure interleaving test (2.3).
4. Per-kind round-trip suite (2.4); fix or exclude.
5. Keyboard audit (2.5).
6. Playwright A-4: 6 fast edits → ⌘Z ×6 fast → server state matches
   original (draft GET); ⌘⇧Z ×3 replays; paste and row insert/delete
   each undone. Plus: type-type-⌘Z immediately (undo racing forward
   writes) — ordering holds via the coordinator.
7. Closeout gate.

## 4. Acceptance

- PRD A-4, plus the burst-with-in-flight-writes drill; excluded kinds
  (if any) documented in PRD + code.

## 5. Notes

- History stays per-table even though the transport lane is per-draft:
  ⌘Z in Rooms must never undo a Ventilators edit.
- No compensating-request scheme after conflicts (canonical contract);
  clearing is the correct response to lineage loss.

## 6. As-built record (2026-07-09)

- Default per-table history capacity is 50 with oldest-entry trimming.
- Undo/redo replays remain ordinary optimistic journal writes, so rapid replay
  preserves FIFO ordering and coalescing. Any accept-time or settled replay
  failure clears both stacks; the journal rollback event covers asynchronous
  transport failure after optimistic acceptance.
- The existing live-region channel now announces `Undid <kind>` and
  `Redid <kind>`. Inline editors stop keyboard propagation, preserving native
  input undo; the grid keyboard path already treats Meta+Z and Ctrl+Z equally.

| Lineage replacement | Clear call site |
|---|---|
| Journal failure / counted rollback | `useJournaledSliceCommit` draft-scoped history event |
| Stale-draft conflict | `handleStaleDraftConflict` |
| Version-locked conflict | `handleVersionLockedConflict` |
| Explicit Reload draft | `reloadDraft` |
| Remote slice/broadcast notification | `notifyRemoteSlice` |
| Discard / discard-and-switch | `useDraftLifecycle.discardDraft` |
| Version switch / controller unmount | DataTable `sessionKey` effect / mount-local refs |

Inverse audit: cell/clear, paste (including inserted rows/options), fill,
rowInsert, rowDelete, and rowDuplicate all retain the existing paired semantic
inverse and now replay through the journal. Typed/legacy schema mutation remains
outside the guaranteed basket. A row-delete inverse restores that table's row
snapshot only; cross-table cascade-cleared links are explicitly not restored.
Focused history/reducer/keyboard/App verification is green, including 50-entry
capacity, replay-failure stack clear, and undo/redo announcements.
