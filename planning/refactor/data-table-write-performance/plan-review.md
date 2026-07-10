---
DATE: 2026-07-09
TIME: -
STATUS: Complete — review findings recorded; packet revisions required before
  implementation handoff.
AUTHOR: Codex (for Ed)
SCOPE: Architecture and completeness review of the DataTable write-performance
  PRD, PLAN, and phase handoffs against current main @ 79f73eb4.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
  - STATUS.md
  - phases/phase-01-write-queue-and-coalescing.md
  - phases/phase-02-optimistic-apply-and-instant-cursor.md
  - phases/phase-03-undo-polish.md
  - phases/phase-04-conflict-messaging-and-self-heal.md
  - phases/phase-05-backend-write-path-trims.md
---

# Plan Review — DataTable Write Performance

## 1. Verdict

The direction is good, but implementation should not begin from the current
packet. The problem statement, evidence, goals, non-goals, phased handoffs, and
verification intent are strong. Several correctness gaps in the proposed queue
and optimistic-state model could nevertheless send operations twice, reverse
row order, detach server failures from the UI, or allow Save/Discard/version
navigation to race pending writes.

This review was performed read-only against current `main` at `79f73eb4`. The
PRD says its findings were verified against older `16bf1b16`; the affected
surfaces must be rechecked while revising the packet.

## 2. Required corrections before implementation

### R-1 — Build each transport payload from the acknowledged base plus only the current batch

Phase 2 currently says:

- the rendered cache contains `fold(lastAcked, queuedOps)`, and
- the dequeued request builds its payload from that optimistic cache.

That sends later queued operations in the current request and then replays them
when their own queue entries execute:

```text
lastAcked + A + B = rendered optimistic slice

request A built from rendered optimistic slice => sends A + B
request B later executes                        => applies B again
```

Repeated cell assignment may appear idempotent, but row inserts, option-list
mutations, and order-sensitive operations are not.

Required invariant:

```text
transport candidate = apply(current in-flight batch only, lastAcked)
rendered slice       = apply(in-flight batch + queued ops, lastAcked)
```

On acknowledgement:

```text
lastAcked = server response
remove acknowledged batch
rendered slice = apply(remaining queued ops, lastAcked)
```

The queue tests must prove that later queued operations never appear in an
earlier request body.

### R-2 — Separate the draft transport lane from per-table optimistic journals

The draft ETag is document-scoped, so one transport lane per open draft is the
correct default. One draft simultaneously has many unrelated `TSlice` types,
however; Equipment and Heat Pumps mount multiple slice controllers together.
A draft-wide queue therefore cannot own a single generic:

```ts
lastAcked: TSlice;
optimistic: TSlice;
```

Use two layers:

1. **Draft write coordinator** — keyed by project/version (and user/session if
   required by the registry lifetime); owns the single document-ETag transport
   lane, queue state, flush/cancel, and failure fan-out.
2. **Per-slice optimistic journal** — owns one table's query key, acknowledged
   slice, in-flight batch, queued operations, applier, overlay recomputation,
   and rollback.

The draft coordinator should schedule typed tasks without understanding their
table-specific slice shapes.

### R-3 — Model optimistic acceptance and server settlement as distinct lifecycles

Today `onWrite` rejects when `mutateAsync` rejects, so
`runWithConflictHandling`, the DataTable caller, and undo/redo all observe the
same failure. Phase 2 proposes resolving `onWrite` at optimistic acceptance.
After that change, the eventual server rejection is detached unless the queue
has a separate observed settlement channel.

Use an explicit handle or equivalent contract:

```ts
type WriteHandle = {
  accepted: Promise<void>; // optimistic apply complete; cursor may move
  settled: Promise<void>;  // server acknowledgement or rejection
};
```

The DataTable may await `accepted`; the controller must always observe
`settled` so it can classify conflicts, drain/rollback, clear history, and set
`editBlocker` / `actionError`. Background rejections must never become detached
or unhandled promises.

### R-4 — Integrate the queue with document lifecycle actions

The canonical DataTable contract already requires Save and Save As to wait for
pending table writes. The current `useDraftLifecycle` has no queue integration,
and the phase plans do not make this a concrete deliverable.

The coordinator must expose `flush()` / `whenIdle()` and explicit cancellation
semantics covering:

- Save and Save As — flush successfully before the version endpoint;
- Save-and-switch — flush before saving and navigating;
- Discard and Discard-and-switch — cancel/drop the optimistic journal before
  deleting the server draft;
- version changes, lock changes, auth/session changes, and controller unmount;
- queue failure while a lifecycle action is waiting.

The proposed Phase-2 instruction to add a `beforeunload` guard if none exists is
stale. `VersionControls.tsx` already installs one whenever a draft exists. The
review question is whether its future behavior should depend on queue state,
not whether a guard exists.

### R-5 — Define row-insert ordering before coalescing

Rapid Shift-Enter gestures can capture the same anchor until the optimistic
render advances the selection. Current row-insert builders splice every new row
immediately after its stated anchor:

```text
start:                    anchor
insert A after anchor:    anchor, A
insert B after anchor:    anchor, B, A
```

Concatenating same-anchor insert operations therefore reverses gesture order,
contradicting A-1's correct-final-order requirement. Correct this by either:

- rewriting each subsequent coalesced insert to anchor on the previously
  inserted row; or
- changing the shared insertion algorithm to preserve grouped insertion order.

Add a cross-table builder contract test for same-anchor inserts.

### R-6 — Specify option-delta coalescing as an algebra, not a shallow merge

A shallow merge of `newOptions` loses earlier additions when two gestures add
options to the same field. Add/remove collisions are also undefined.

The coalescer must define and test:

- union of additions by option id;
- union of removals;
- add-then-remove and remove-then-add precedence;
- option-order normalization;
- per-gesture inverse preservation after transport coalescing.

Recommendation: land serialization first with no coalescing. Add coalescing as
a separate step only after the queue and optimistic journal are correct.

### R-7 — Require three-way conflict preconditions for transparent retry

Phase 4 allows retrying a cell/fill operation when its row still exists. That
can silently overwrite another editor's change to the same cell.

Transparent retry is safe only when the authoritative value after refetch still
equals the value observed when the local operation was created:

```text
remote current value == local operation's observed base value
```

If the same cell changed, surface a conflict. The journal therefore needs the
operation's base/precondition data—possibly the existing semantic inverse—rather
than only the forward `WriteOp` currently received by the controller.

The PRD should also correct its data-loss characterization. Once the cursor
moves optimistically, a failure can reject a large backlog of accepted
keystrokes, which is more unsaved work than the blocking UI permits today.
Report the rejected operation count and retain a recoverable failed-operation
buffer if practical.

## 3. Scope corrections

### 3.1 This packet covers slice-backed project-document DataTables, not all DataTables

The packet covers the 14 editable project-document tables using
`createTableSliceFeature` / `useSliceTableController`:

- Rooms and Space Types;
- Thermal Bridges;
- seven standard Equipment tables;
- four Heat Pump leaf tables.

The three editable Catalog DataTables use separate row-level catalog APIs and
custom controllers. For example, Materials groups cell writes by row, sends
parallel PATCH requests, and invalidates/refetches the catalog. They still
inherit the DataTable's blocking `onWrite` promise and can have their own
write-performance/race behavior.

Required packet change:

- name and scope this work explicitly as **project-document slice-backed
  DataTables**; and
- record Catalog optimistic row mutation/batching/invalidation as a follow-up.

PRD F-10's statement that Catalogs ride the slice path is incorrect.

### 3.2 Reconcile the packet with the canonical DataTable contract

`context/technical-requirements/data-table.md` already states requirements for:

- one FIFO queue per open draft/table instance;
- optimistic application;
- Save/Save As flushing;
- rollback and undo clearing on failures.

The PRD simultaneously says these decisions have not been user-ratified.
Determine whether the context document was updated prematurely or whether those
items are already accepted, then make the source-of-truth documents agree.

## 4. Backend corrections

### R-8 — Correct the ETag/cache-key description

Saved-version ETags are content hashes. Draft ETags are not: the backend derives
them from the serialized content hash plus a random UUID. A draft ETag remains
a useful immutable revision token for a process-local cache, but the plan must
not call it the body content hash.

Prefer keys based on identifiers already available without another canonical
serialization pass, for example:

- saved body: `(version_id, updated_at)`;
- draft body: `(version_id, user_id, draft_etag)`.

### R-9 — Instrument the full backend write path before choosing the cache target

F-7 undercounts whole-document work. In addition to parsing the saved version
and existing draft in `write_spine.py`, many table contracts call
`validate_document(next_body.model_dump(...))` after applying the replacement.
That outgoing full-document validation may dominate and is not removed by an
input-document cache.

Stage-A instrumentation should include:

- saved-version parse/upgrade;
- draft parse/upgrade;
- table payload parsing;
- mutation / table-contract application;
- outgoing whole-document validation;
- asset-reference validation;
- serialization/hash;
- draft SQL;
- response-slice construction;
- total transaction and total request time;
- request and response bytes.

Aggregate the complete timing event in the write-spine/service layer. The
repository's existing `project_document.saved` event only owns SQL timing and
cannot accurately observe the higher-level stages.

### R-10 — Do not let acknowledgement side effects stall queue throughput

`applyAcceptedSlice` currently awaits:

- draft-summary invalidation/refetch;
- sibling-slice invalidation;
- `onAcceptedSlice` broadcast work.

TanStack Query awaits async mutation-success callbacks, so the proposed queue
pump can wait for ancillary work—potentially another network round trip—before
sending the next PUT.

Split acknowledgement handling into:

1. correctness-critical synchronous work: install accepted slice, advance
   acknowledged ETag, mark siblings invalidated;
2. noncritical post-ack effects: draft-summary refresh and broadcasts, which
   must not block the next queued request unless measurement proves they must.

Consider patching the draft-summary cache directly from accepted response data
and refreshing it in the background.

## 5. Recommended implementation sequence

Replace the current phase order with the following dependency sequence:

1. **Observability + contract audit**
   - re-inventory current write surfaces on current `main`;
   - add queue depth, wait time, request RTT, ack-side-effect time, payload
     bytes, coalescing ratio, and backend stage timings;
   - write deterministic delayed-request tests.
2. **Draft transport coordinator — serialization only**
   - one draft-scoped transport lane;
   - no coalescing yet;
   - explicit `accepted`, `settled`, `flush`, `cancel`, and observable status;
   - route every slice/schema/modal mutation and lifecycle action.
3. **Per-table optimistic journals**
   - transport candidate from acknowledged base + current batch only;
   - rendered overlay from acknowledged base + all outstanding operations;
   - deterministic rebase and rollback tests.
4. **Coalescing**
   - row-order and option-delta semantics;
   - per-gesture history retained while transport batches merge.
5. **Undo + failure recovery**
   - journal-aware history;
   - burst-safe undo/redo;
   - failed-operation retention and lineage clearing.
6. **Conflict copy + narrowly safe retry**
   - structured error classification;
   - three-way precondition checks;
   - no silent same-cell last-writer-wins.
7. **Backend optimization**
   - act only on expanded measurements;
   - cache or remove the measured dominant work, not the assumed one.

## 6. Architecture alternatives worth evaluating

### 6.1 TanStack Query mutation scopes

The installed TanStack Query v5 supports serial mutations sharing a
`scope.id`. Evaluate a draft-keyed mutation scope as the minimal Phase-1
serialization substrate. It does not provide coalescing, per-slice journals,
flush/cancel semantics, or document-lifecycle coordination, so it does not
eliminate the coordinator.

### 6.2 Ordered semantic-command endpoint

For the longer term, spike an additive endpoint such as:

```text
POST /draft/tables/{table}/commands
{ operations: [WriteOp, ...] }
```

This can preserve the JSONB document model and shared `apply_document_write`
spine while moving rebasing and batching under the backend row lock. It reduces
payload size and removes much of the browser's whole-slice replacement algebra.
The existing aperture command endpoint is relevant prior art.

The current PRD rejects semantic/delta endpoints without comparing this option.
That is acceptable for the immediate refactor only after the alternative and
its tradeoffs are recorded explicitly.

## 7. What should remain from the current packet

Retain:

- the production symptoms and end-to-end write-path evidence;
- draft-scoped serialization as the default concurrency boundary;
- no-delay dispatch of the first queued operation;
- optimistic cursor advancement as the perceived-latency target;
- one semantic history entry per gesture;
- truthful machine-code-based conflict messages;
- measure-gated backend optimization;
- unit, contract, browser, and two-tab verification layers.

Defer until their prerequisites are proven:

- transport coalescing;
- transparent conflict self-heal;
- validated-document caching.

## 8. Implementation gate

Do not hand Phase 1 to implementation until the packet has been amended to:

- resolve R-1 through R-7 in the frontend architecture;
- add lifecycle flush/cancel acceptance criteria;
- correct the project-table versus Catalog scope;
- resolve the canonical-doc/PRD decision-state inconsistency;
- expand backend measurement per R-8 through R-10;
- update phase dependencies and tests to the revised sequence.

