---
DATE: 2026-07-09
TIME: -
STATUS: Planned — hard dependency on phase-01 (queue must exist first).
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 2 — commit resolves at
  optimistic-apply time so the cursor advances instantly; the queued
  write reconciles in the background; failures roll back with an honest
  banner. Fixes S-2. Frontend only.
RELATED:
  - ../PRD.md §2 (F-2, F-3, F-9), §5, §6 (D-5, D-6, D-7), §7 (A-2, A-3, A-5), §8 (R-1, R-2)
  - phases/phase-01-write-queue-and-coalescing.md (the substrate)
  - frontend/src/shared/ui/data-table/feature/types.ts (SlicePayloadBuilders)
  - frontend/src/shared/ui/data-table/feature/useSliceTableController.ts
  - frontend/src/features/project_document/table-slice.ts (applyAcceptedSlice)
  - frontend/src/shared/ui/data-table/hooks/useGridEdit.ts + components/GridBody.tsx:494 (commit-then-move)
---

# Phase 2 — Optimistic apply + instant cursor advance

## 1. Goal

Committing a cell (Enter/Tab), inserting a row (Shift-Enter), pasting,
filling — all reflect in the grid and free the cursor within one frame.
The server write happens behind the user through the Phase-1 queue. On
success nothing visibly changes (the ack slice matches the optimistic
one); on failure the table visibly reverts to the authoritative slice
with a truthful banner.

## 2. Design

### 2.1 The optimistic overlay model

Per draft queue, maintain:

- `lastAcked: TSlice` — the last server-returned slice (source of
  truth for `If-Match`, always).
- `optimistic: TSlice` — `fold(applyOp, lastAcked, queuedOps)` — what
  the grid renders.

Rules:

- **Enqueue:** apply the op to `optimistic`, `setQueryData(sliceKey,
  optimistic)`, resolve the gesture's dispatch promise → cursor moves.
- **Ack:** `applyAcceptedSlice` sets `lastAcked` = server slice, then
  recompute `optimistic = fold(lastAcked, remaining queued ops)` and
  `setQueryData` that (NOT the raw ack) — this prevents an ack from
  clobbering the optimistic state of ops still in the backlog (R-2).
  When the queue is idle, `optimistic === lastAcked` and behavior is
  byte-identical to today.
- **Payload building at dequeue** uses `optimistic` (the op was typed
  against it); **headers** use `lastAcked.draft_etag`. This split is
  the crux — `draftWriteHeaders(lastAcked)` + `buildPayload(optimistic)`.
  Note this changes Phase 1's "resolve slice from cache" rule: the
  cache now holds the *optimistic* slice, which is exactly what payload
  builders should see, but etags must come from `lastAcked` tracked by
  the queue, not from the cache.
- **Failure (PRD D-6):** drop overlay, `setQueryData(lastAcked)` (or
  the refetched slice from the conflict path), drain queue, clear
  history, banner.

### 2.2 The applier (PRD D-5)

The overlay needs `applyOp(slice, op, build): TSlice`. Two candidate
shapes — **investigate first, pick one, record the decision**:

- **(a) Reuse the payload builders.** Precedent F-9: `composePastePayload`
  already treats builder output as slice-shaped (`as unknown as
  TSlice`). If that cast is truthful for ALL current tables (audit each
  `TPayload` vs `TSlice`: rows, field_defs, option lists — the slice
  additionally carries envelope fields like etags/source that the
  payload lacks), then
  `applyOp = (slice, op) => ({ ...slice, ...buildPayload(slice, op) })`
  is a single shared helper and **zero new per-table code**. Preferred
  if the audit passes.
- **(b) New required builder** `applyOp` on `SlicePayloadBuilders`,
  with a shared generic implementation for the standard envelope and a
  required explicit binding per table (a one-liner). Choose this only
  if (a)'s audit finds a table whose payload is not slice-shaped.

Either way: uniform across tables, compile-enforced, no silent opt-out
(D-1).

### 2.3 Unblocking the cursor

- `useGridEdit.commit()` (`useGridEdit.ts:187-227`): `dispatchWrite`
  now resolves at enqueue+optimistic-apply time (the controller's
  `onWrite` returns the enqueue promise's *acceptance*, not the ack).
  Decide the exact promise contract: **recommendation** — `onWrite`
  resolves on optimistic-accept, and the queue exposes
  `whenIdle()`/per-op ack promises for the few callers that genuinely
  need ack (e.g. `insertRowBelow`'s `queuePendingEdit` does NOT need
  ack — the optimistic slice already contains the new row, so the
  pending-edit can open immediately; verify `consumePendingEdit`
  fires off the optimistic render).
- `commitInFlightRef` stays as a synchronous re-entrancy guard for the
  local phase (validate + apply is sync-fast; the guard window shrinks
  to microseconds).
- History push (`useGridWriteReducer.ts:42-44`) now happens on
  optimistic-accept. Combined with D-6 (history cleared on any write
  failure) the semantics stay sound: an entry exists only while its op
  is either in flight or acked, and any failure wipes the stack.
- `RecordDetailModal` and other non-grid editors that await `onWrite`
  get the same fast-resolve; audit for any UI that used the await as a
  "saved!" signal and, where truly needed, switch it to the ack promise.

### 2.4 What stays ack-side (PRD D-7)

`markLocalDraftTouched`, draft-summary invalidation, sibling staling,
`onAcceptedSlice` broadcast — all remain exactly where they are, firing
per server response. The draft-status badge therefore lags typing by
one RTT; acceptable and unchanged from today.

## 3. Out of scope

- Undo behavior changes beyond what §2.3 implies (Phase 3).
- Error-copy changes and self-heal retries (Phase 4).
- Any spinner/saving-indicator redesign — but see §4 step 6.

## 4. Step-by-step

1. Applier decision (§2.2): audit every registered table's
   `TPayload` vs `TSlice`; write the (a)/(b) decision + evidence into
   this file's As-built section before coding.
2. Add `lastAcked`/overlay state to the Phase-1 queue module + fold
   recompute on ack; unit-test the interleavings (§5) BEFORE touching
   the controller.
3. Rewire controller: optimistic setQueryData on enqueue; headers from
   `lastAcked`; payloads from optimistic cache slice.
4. Resolve-on-accept promise contract through `onWrite` →
   `dispatchWrite` → `edit.commit()`; verify GridBody commit-then-move
   now completes in-frame (React DevTools profiler or rAF timestamp in
   a test).
5. `insertRowBelow`/`queuePendingEdit` on optimistic row; paste and
   fill paths; RecordDetailModal audit.
6. Failure UX: reuse the existing `editBlocker` banner; verify the
   visible revert (two-tab drill, A-5). Add a minimal "unsaved changes
   in flight" beforeunload guard **only if** one doesn't exist —
   check first; note the sun-study lesson that beforeunload wedges MCP
   tab input, so gate it to queue-non-idle only.
7. Playwright: A-2 (10-cell full-speed burst) and A-3 (Slow-3G cursor
   advance) scripted; assert server final state via draft GET.
8. Closeout gate.

## 5. Test matrix (unit — the R-2 interleavings)

- enqueue A,B; ack A while B queued → cache = fold(ackA, B), not ackA.
- ack slice differs from optimistic prediction (server normalized a
  value) → fold rebases B's effect onto the server's version; final
  cache after B's ack = server truth.
- failure of A with B,C queued → cache reverts to lastAcked (pre-A),
  B/C rejected, history cleared, banner shown once (not three times).
- idle queue → optimistic === lastAcked === cache (identity check).
- remote broadcast slice arrives mid-backlog (Rooms) → next dequeue
  still sends lastAcked etag; on 409 the standard failure path runs.
  (Codifies today's behavior; no new cleverness.)
- undo entry pushed on accept, wiped on failure (bridge to Phase 3).

## 6. Acceptance (from PRD)

- A-2, A-3 verbatim; A-5 (revert visible + honest); A-6 regression
  list; re-run Phase-1's A-1 to confirm no regression.

## 7. Risks / notes

- **The etag/payload split (§2.1) is where bugs will live.** Keep
  `lastAcked` private to the queue module; forbid reading etags from
  the query cache anywhere in the write path (lint-able: grep test in
  the contract suite).
- Server-normalized values (backend may reorder/canonicalize) make
  optimistic ≠ ack briefly; the fold-on-ack rule self-corrects. Don't
  diff-and-warn; just converge.
- If step 1's audit forces option (b) and a table's applier is
  non-trivial (e.g. option-delta bookkeeping), copy the exact semantics
  from its payload builder — the two must never diverge (single source:
  prefer deriving one from the other).
