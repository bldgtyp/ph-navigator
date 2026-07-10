---
DATE: 2026-07-09
TIME: -
STATUS: Planned — hard dependency on phase-01.
AUTHOR: Claude (for Ed); state model per plan-review R-1/R-2/R-3/R-10
SCOPE: Implementation handoff for Phase 2 — per-slice optimistic
  journals over the phase-01 coordinator: transport from acked base +
  in-flight batch only, rendered overlay from base + all outstanding
  ops, accepted-resolves-early (instant cursor), ack-side-effect split,
  rollback with rejected-op count. Fixes S-2.
RELATED:
  - ../PRD.md §6 (invariants), §7 (D-3, D-5, D-6, D-7), §8 (A-2, A-3, A-5, A-9), §9 (R-A, R-B)
  - ../plan-review.md R-1, R-2, R-3, R-10, §5 step 3
  - phases/phase-01-draft-write-coordinator.md (substrate)
  - frontend/src/shared/ui/data-table/feature/types.ts (SlicePayloadBuilders; composePastePayload F-9 precedent)
  - frontend/src/features/project_document/table-slice.ts (applyAcceptedSlice — being split per D-7)
  - frontend/src/shared/ui/data-table/hooks/useGridEdit.ts + components/GridBody.tsx:494
---

# Phase 2 — Per-slice optimistic journals + instant cursor

## 1. Goal

Cell commit, row insert, paste, fill reflect in the grid and free the
cursor within one frame; the coordinator drains behind the user. On
settle-success nothing visibly changes; on failure the table reverts to
the authoritative slice with a banner stating how many operations were
rejected.

## 2. Design

### 2.1 Journal state (one per mounted slice controller)

```ts
type SliceJournal<TSlice> = {
  lastAcked: TSlice;          // last server response; sole payload base + etag source
  inFlight: JournalOp[];      // ops in the request currently on the wire (this phase: exactly 1)
  queued: JournalOp[];        // accepted, not yet dispatched
};

type JournalOp = { op: WriteOp; inverse: WriteOp; handle: WriteHandleInternals };
```

**The R-1 invariant (the core of this phase):**

```
transport payload = applyOps(lastAcked, inFlight)          // NEVER from rendered slice
rendered cache    = applyOps(lastAcked, inFlight ++ queued)
If-Match          = lastAcked.draft_etag (or version etag when no draft)

on ack:  lastAcked = server slice; inFlight = []; promote next op;
         rendered = applyOps(lastAcked, inFlight ++ queued)   // rebase
on fail: reject inFlight + queued (count them); journal reset to
         lastAcked (or refetched slice); rendered = that; clear history
```

Unit tests MUST prove a queued op never appears in an earlier request
body (row-insert double-apply is the canary — see §5).

The journal owns its table's query key and is the only writer of that
cache entry on this path; `applyAcceptedSlice`'s cache-write moves into
the journal's ack step (invalidation side effects split per §2.4).

### 2.2 The applier (D-5 — audit first, then pick)

The journal needs `applyOps(slice, ops): TSlice`. Step 1 is the audit:
for each of the 14 tables, does `{...slice, ...buildPayload(slice, op)}`
(F-9 precedent) reproduce the slice a server round-trip would return —
rows, field_defs, option lists (envelope fields like etags/source are
journal-owned and excluded)? Record the per-table result here.

- All pass → shared helper deriving `applyOps` from the existing
  builders; zero new per-table code.
- Any fail → required `applyOp` builder on `SlicePayloadBuilders` with
  the shared generic default; explicit binding per table. Semantics
  must be derived from (not parallel to) the payload builders so the
  two can't drift.

Known divergence to handle either way: server-side normalization
(ordering, canonical numbers). Rule: don't chase byte-equality — the
ack rebase (§2.1) self-corrects; the audit only needs "no data loss,
no structural mismatch".

### 2.3 Accepted-resolves-early

- Controller `onWrite` validates the op, appends to the journal,
  updates the rendered cache, resolves `accepted` → `edit.commit()`
  returns → GridBody moves the cursor. Target: no awaited network
  before `accepted` (A-3).
- `dispatchWrite` pushes the history entry on `accepted` (it already
  awaits `onWrite`, whose resolution is now optimistic-accept). D-6
  wipes history on any settle-failure, keeping entries honest.
- `insertRowBelow` / `queuePendingEdit`: the optimistic slice contains
  the new row, so the pending edit opens immediately; the tmp rowId is
  the permanent id (client-generated) — verify `consumePendingEdit`
  fires from the optimistic render.
- Validation failure at accept-time (payload `validate`) rejects
  `accepted` AND `settled` synchronously — cursor stays, current
  error UX unchanged.
- Audit `onWrite` awaiters found in the phase-00 inventory for
  anything that used the await as a "saved" signal (RecordDetailModal,
  RoomModal): those switch to `settled`.

### 2.4 Ack-side-effect split (D-7 / R-10)

On settle-success, synchronously (blocking the pump): install
`lastAcked`, rebase-render, mark sibling slices invalidated
(`refetchType:"none"` — no network). NOT blocking the pump:
draft-summary refresh (patch its cache from the response if the shape
allows, background-invalidate otherwise), `onAcceptedSlice` broadcast,
`markLocalDraftTouched`. Concretely: stop `awaiting` the non-critical
`Promise.all` inside the mutation's `onSuccess` (TanStack awaits async
onSuccess — F-13); fire-and-track instead, with rejections logged, and
`flush()` NOT waiting on them.

### 2.5 Rollback UX (D-6, R-A)

Failure path = phase-01 drain + journal reset + `history.clear()` +
banner via existing `editBlocker`, with copy including the rejected-op
count ("3 unsaved changes were discarded"). One banner per drain, not
per op. Failed-op recovery buffer: deferred (v1.1), noted in PRD.

## 3. Out of scope

Coalescing (03 — `inFlight` is a batch structurally, but carries
exactly one op in this phase), undo capacity/coverage (04), conflict
copy/retry (05), backend (06).

## 4. Step-by-step

1. §2.2 applier audit table (all 14 tables) → decision recorded here.
2. Journal module + R-1 invariant unit matrix (§5) against the
   phase-00 harness — written and green against a fake transport
   BEFORE controller wiring.
3. Controller wiring: journal owns cache writes; accepted-early
   promise plumbing through `onWrite`/`dispatchWrite`/`commit()`.
4. D-7 split in `table-slice.ts` (+ draft-summary cache patch if
   shape allows).
5. Pending-edit-on-optimistic-row; paste/fill paths; modal awaiter
   audit.
6. Playwright: A-2 (10-cell burst), A-3 (Slow-3G cursor), A-5 revert
   drill (with count in banner); re-run A-1, A-8 (flush now waits for
   real backlog).
7. Closeout gate.

## 5. Test matrix (the R-1/R-B interleavings — unit, deterministic)

- ops A,B,C accepted while A in flight → request A body contains ONLY
  A's effect; B,C absent (row-insert triple: exactly one new row in
  request A).
- ack(A) while B,C queued → rendered = acked ⊕ B ⊕ C; request B built
  from acked base ⊕ B only.
- server-normalized ack (differs from optimistic prediction) → rebase
  converges; final state after full drain = server truth.
- fail(B) with C queued, A acked → rendered reverts to ack(A) state;
  B,C rejected with count=2; history cleared; single banner; next
  schedule works.
- settle-rejection always observed (A-9 strict unhandled-rejection).
- idle journal → rendered === lastAcked (identity).
- flush() resolves only after settle of everything accepted before the
  flush call; ops accepted after flush() was called are not waited on
  (define and test this boundary explicitly).

## 6. Notes

- **Etag custody moves here:** `If-Match` comes from
  `journal.lastAcked`, never from the query cache (which now holds the
  rendered optimistic view). Grep-test in the contract suite: nothing
  on the write path reads etags from `getQueryData`.
- Keep the journal per-table and typed; the coordinator stays
  shape-blind (R-2). The journal hands the coordinator a closed
  `run()` thunk per dispatch.
- Draft-status badge intentionally lags typing by one settle (D-7);
  unchanged from today's feel.
