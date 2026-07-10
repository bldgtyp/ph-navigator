---
DATE: 2026-07-09
TIME: -
STATUS: Planned — ready for implementation after PRD decision review.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 1 — serialize every slice-table
  write through a per-draft FIFO queue with same-kind coalescing.
  Fixes S-1 (rapid-entry etag races). UX latency unchanged until
  Phase 2. Frontend only; zero backend/API change.
RELATED:
  - ../PRD.md §2 (F-4, F-6), §6 (D-1…D-4, D-11), §7 (A-1, A-6) — read in full first
  - frontend/src/shared/ui/data-table/feature/useSliceTableController.ts
  - frontend/src/features/project_document/table-slice.ts
  - frontend/src/shared/ui/data-table/hooks/useGridWriteReducer.ts (context only — unchanged here)
  - frontend/src/shared/ui/data-table/__tests__/sharedEditContract.test.ts
---

# Phase 1 — Per-draft write queue + coalescing

## 1. Goal

After this phase, N rapid gestures on any slice-backed table produce N
successful, ordered writes with zero 409s single-tab — because no write
is sent until the previous write's response (and fresh `draft_etag`)
has been applied, and queued backlog is coalesced into fewer PUTs.
Perceived latency is intentionally unchanged (commit still resolves on
server ack); Phase 2 changes that.

## 2. Design

### 2.1 The queue

New module `frontend/src/features/project_document/writeQueue.ts`:

```ts
type QueuedWrite = {
  op: WriteOp | SchemaMutationTask | PreflightTask;   // see §2.4
  execute: (writableSlice) => Promise<unknown>;        // built at dequeue
  resolve/reject: settle the caller's promise;
};

createDraftWriteQueue(): {
  enqueue<T>(task): Promise<T>;
  size(): number;
  isIdle(): boolean;
}
```

- **Scope: per project-version draft** (PRD D-2a default): a
  module-level registry `Map<`${projectId}:${versionId}`,
  DraftWriteQueue>` so all tables of one draft share one FIFO. The
  draft etag is document-level, so this closes the cross-table race
  too. Registry entries are removed when drained AND no controller is
  subscribed (avoid leaks across project navigation).
  - **First task: confirm D-2a.** If review finds per-draft ordering
    creates unacceptable cross-table head-of-line blocking (it
    shouldn't — a user edits one table at a time), fall back to
    per-table queues; the module API is identical either way.
- **Pump:** single async loop per queue. While items remain: take head
  batch → coalesce (§2.2) → run `execute` → settle → next. Exactly one
  request in flight per queue, ever.
- **Failure drain (PRD D-6):** if `execute` rejects, reject that item
  AND every item currently behind it with a dedicated
  `WriteQueueDrainedError` (callers must distinguish "your op failed"
  from "an earlier op failed"); empty the queue; leave the pump idle.
  The *first* rejection carries the original error so the existing
  `runWithConflictHandling` classification (stale / locked / other)
  still works.

### 2.2 Coalescing (PRD D-4)

Only adjacent, same-table, same-kind ops merge, and only these kinds:

- `cell` + `cell` → concatenate `writes`, shallow-merge `newOptions`,
  concatenate `removedOptions` lists per key. Later writes to the same
  `(rowId, fieldKey)` win (order-preserving concat already gives this
  since payload builders apply writes in order — verify and test).
- `rowInsert` + `rowInsert` → concatenate `rows` (order preserved).

Everything else (paste, fill, rowDelete, rowDuplicate, schema
mutations, option replace, preflights) never coalesces. Coalescing is a
transport optimization only; the caller promises for each merged
gesture all settle from the single request's outcome, and history
entries remain per-gesture (unchanged — `dispatchWrite` already pushes
one entry per gesture after its promise resolves).

### 2.3 Execution-time slice resolution (PRD D-3 — fixes F-6)

`commitPayloadOrThrow` currently closes over the render-prop `slice`.
Under a queue, dequeue can happen many renders later, so:

- Change `resolveSliceForWrite` (`useSliceTableController.ts:264-272`)
  to read `queryClient.getQueryData<TSlice>(editorSliceQueryKey)`
  **first** and fall back to the closure `slice`, keeping the existing
  `isInvalidated → refetch` branch. This is also a strict improvement
  for today's non-queued callers.
- `If-Match` derivation is untouched: `draftWriteHeaders(current)` with
  `current` = the slice resolved at dequeue time = last acked slice
  (the cache is only written by `applyAcceptedSlice` in this phase).

### 2.4 Wiring the controller through the queue

In `useSliceTableController`:

- `commitPayloadOrThrow` and `commitSchemaMutation` change from
  "run now" to "enqueue an execute-closure on the draft queue". The
  closure does exactly what the body does today: resolve slice → build
  payload → `validate` → `mutateAsync`. `runWithConflictHandling`
  wrapping stays on the caller side of the enqueue so banners/blockers
  behave identically.
- **Validation timing decision:** `payloadBuilders.validate` runs at
  dequeue (payload exists only then). A validation failure follows the
  drain rule (D-6) — document this in the code: by the time op N fails
  validation, ops N+1… were typed against a state that assumed N
  applied.
- **Audit all bypass routes** (PRD R-4) and route them through the same
  queue: `previewReplace` preflights (cascade previews must not
  interleave with writes), Rooms modal `saveRoom` via
  `runWithConflictHandling`, custom-field handlers
  (`useCustomFieldHandlers` → `commitSchemaMutation` — covered), and
  any direct `replaceMutation` callers found by grep. Deliverable: a
  short table in the PR description listing every write entry point and
  its queue route.

### 2.5 `isReplacePending` (PRD D-11)

Redefine as `replaceMutation.isPending || !queue.isIdle()` and expose
via the controller unchanged in name. Audit consumers (footer "+"
gating etc.) for behavior that assumed at-most-one-write.

## 3. Out of scope

- Any change to when `edit.commit()` resolves (Phase 2).
- Optimistic cache writes (Phase 2).
- Undo capacity/routing (Phase 3) — but note undo/redo already call
  `onWrite`, so they are queued for free after this phase.
- Backend anything.

## 4. Step-by-step

1. Confirm D-2a (per-draft vs per-table) with a 15-minute code check of
   sibling-slice write interleavings; record in `decisions` note in
   this file's As-built section.
2. Build `writeQueue.ts` + unit tests (see §5) — pure TS, no React.
3. Rewire `resolveSliceForWrite` per §2.3 (+ regression test).
4. Rewire `commitPayloadOrThrow` / `commitSchemaMutation` /
   `previewReplace` path per §2.4.
5. Entry-point audit sweep (grep `mutateAsync`, `replaceSlice`,
   `previewReplace`, `mutateSchema`) — route or justify each.
6. `isReplacePending` redefinition + consumer audit.
7. Playwright smoke: A-1 (Shift-Enter ×5 burst) and a 10-cell
   type-Tab burst on a seeded table; assert no banner and correct final
   values via the draft GET.
8. Closeout gate (simplify, docs-pass, `make format`, `make ci`).

## 5. Test matrix (unit, colocated)

- enqueue 3 → executes serially, order preserved, results settle
  individually.
- coalesce: cell+cell merged (writes order, option-delta merge);
  cell+rowInsert NOT merged; merged gesture promises all resolve.
- same-cell double write within one batch → later value wins in the
  built payload.
- failure at op 2 of 4 → op 2 rejects with original error; ops 3-4
  reject with `WriteQueueDrainedError`; queue empty; next enqueue after
  drain runs normally.
- `resolveSliceForWrite` prefers fresh cache data over a stale closure
  slice (simulate: setQueryData between enqueue and dequeue).
- registry: two tables of one draft share a queue (if D-2a holds); two
  drafts don't; queue GC'd after drain + unsubscribe.
- Extend `sharedEditContract.test.ts`: rapid double `onWrite` from any
  registered table never yields overlapping `mutateAsync` calls
  (enforces D-1 uniformity for every current and future table).

## 6. Acceptance (from PRD)

- A-1 verbatim; A-2 with the caveat that per-cell latency still equals
  RTT (queue absorbs the burst; nothing is lost or errored).
- A-6 regression list all green.

## 7. Risks / notes for the implementer

- TanStack `mutateAsync` retains per-call `onSuccess`
  (`applyAcceptedSlice`) — keep using the existing mutation object so
  ack-side effects (D-7) are untouched.
- Do NOT debounce or delay the first op — the queue must dispatch
  immediately when idle (keystroke #1 should hit the wire exactly as
  fast as today).
- Beware `useCallback` identity churn: the queue registry lives at
  module level precisely so controller re-renders don't recreate queues
  or drop backlog.
- The Rooms broadcast path (`useRoomsDraftBroadcast`) applies remote
  slices via `setQueryData`; with the queue, a remote slice arriving
  mid-backlog will be overwritten by our next ack or 409 us — same as
  today, handled by conflict path. No special-casing in this phase.
