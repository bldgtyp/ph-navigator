---
DATE: 2026-07-09
TIME: -
STATUS: Draft for review — findings verified against main @ 16bf1b16;
  decisions D-1…D-11 proposed, none yet user-ratified except overall
  direction (queue → optimistic → undo polish) approved in session.
AUTHOR: Claude (for Ed)
SCOPE: Behavior + architecture contract for making DataTable data-entry
  keep up with the user: serialized/coalesced writes, optimistic apply,
  reliable ⌘Z, honest conflict errors, and measure-gated backend trims.
RELATED:
  - frontend/src/shared/ui/data-table/hooks/useGridWriteReducer.ts (dispatch chokepoint)
  - frontend/src/shared/ui/data-table/hooks/useGridEdit.ts (commit lifecycle)
  - frontend/src/shared/ui/data-table/hooks/useGridHistory.ts (undo stacks)
  - frontend/src/shared/ui/data-table/feature/useSliceTableController.ts (onWrite, resolveSliceForWrite)
  - frontend/src/features/project_document/table-slice.ts (PUT + If-Match + applyAcceptedSlice)
  - backend/features/project_document/write_spine.py (lock + etag + persist)
  - backend/features/project_document/validation.py (whole-doc parse/serialize/hash)
  - context/technical-requirements/* (JSON-document model contract)
  - planning/archive/dated/2026-06-29/equipment-draft-etag-coordination/ (prior art)
---

# PRD — DataTable Write Performance & Undo

## 1. Problem statement

Now that production has real data-entry sessions, two symptoms recur:

- **S-1 (errors under rapid entry):** pressing Shift-Enter 5× to add 5
  rows fails after ~2 with a "draft changed in another tab" banner.
- **S-2 (pause between cells):** after committing a cell, there is a
  noticeable delay before the next cell accepts input.

And one capability gap:

- **S-3 (undo):** ⌘Z should reliably undo basic table operations
  (write / edit / clear / paste, row insert/delete).

## 2. Current-state findings (verified 2026-07-09)

The write path, end to end:

```
InlineCellEditor Enter/Tab
  → GridBody: edit.commit().then(move)             GridBody.tsx:494
  → useGridEdit.commit(): await dispatchWrite      useGridEdit.ts:187-227
  → useGridWriteReducer.dispatchWrite: await onWrite, then history.push
  → useSliceTableController.onWrite → commitPayloadOrThrow
      → resolveSliceForWrite()                     useSliceTableController.ts:264
      → replaceMutation.mutateAsync                useSliceTableController.ts:289
  → PUT /draft/tables/{name}  If-Match: draft_etag table-slice.ts:68-82,238
  → onSuccess: applyAcceptedSlice (setQueryData + invalidations)
```

Load-bearing facts:

- **F-1 — Whole-table writes.** There is no per-cell/per-row endpoint.
  A one-cell edit and a row insert both `PUT` the entire table envelope
  (`table-slice.ts:68-82`; backend `routes.py:121-137` →
  `drafts.py:48-77`).
- **F-2 — No optimistic update.** No `onMutate` anywhere in the write
  path; the cache updates only from the server response in
  `applyAcceptedSlice` (`table-slice.ts:190-223`).
- **F-3 — Cursor blocks on the round-trip.** Enter/Tab move only inside
  `edit.commit().then(...)` (`GridBody.tsx:494-496`), and `commit()`
  awaits the PUT. This is S-2. The editor input is not disabled during
  flight; only the move is deferred. A re-entrancy guard
  (`commitInFlightRef`, `useGridEdit.ts:108,189,199,226`) *rejects* (not
  queues) a second commit.
- **F-4 — No client-side write serialization.** Shift-Enter is
  fire-and-forget (`useGridKeyboard.ts:142-147` → `void
  onRowInsertBelowActive()`); `insertRowBelow` (`DataTable.tsx:591-666`)
  has no in-flight guard on the PUT. `dispatchWrite` is a chokepoint but
  not a queue. Two writes inside one RTT carry the **same** `If-Match`
  etag; the backend row-lock serializes them, rotates the etag on the
  winner (`write_spine.py:99-105,190-199`), and 409s the rest
  (`draft_etag_mismatch`). This is S-1.
- **F-5 — The error message lies.** The 409 from F-4 is surfaced via
  `runWithConflictHandling` → `handleStaleDraftConflict`
  (`useSliceTableController.ts:205-262`) with copy like "The Pumps draft
  changed in another tab. Reload the draft before editing." — wrong for
  the single-tab rapid-entry case.
- **F-6 — Closure-staleness hazard.** `resolveSliceForWrite`
  (`useSliceTableController.ts:264-272`) returns the render-closure
  `slice` prop when the query isn't invalidated; correctness currently
  depends on a re-render delivering the fresh etag between writes. Any
  scheme that defers execution (a queue) must instead read the latest
  slice from the query cache at execution time.
- **F-7 — Server cost scales with document, not edit.** Each write:
  whole-doc `SELECT … FOR UPDATE`, up to **two** full Pydantic
  parses+migrations (saved version body and draft body,
  `write_spine.py:84,107` → `validation.py:84-108`), whole-doc canonical
  `json.dumps` + sha256 (`validation.py:35-45`), whole-doc JSONB upsert
  (`repository.py:93-137`). Plus ~3 DB transactions per request (session
  lookup w/ throttled `last_seen_at` write, access check, write spine).
  8 MiB doc cap (`config.py:73`). `db_ms` is already logged
  (`repository.py:295-296`, event `project_document.saved`).
- **F-8 — Undo exists.** `useGridHistory` (capacity **8**,
  `useGridHistory.ts:21`) + `useGridWriteReducer` pair every gesture
  with a semantic inverse `{op, inverse}`; ⌘Z/⌘⇧Z bound
  (`useGridKeyboard.ts:113-119`, `DataTable.tsx:912-919`). Undo/redo
  replay the inverse as a normal blocking write (`useGridWriteReducer.ts:49-61`)
  — so rapid ⌘Z hits the same S-1 race. History is per-table-mount,
  in-memory.
- **F-9 — Payloads are slice-shaped in practice.**
  `composePastePayload` (`feature/types.ts:87-100`) chains payload
  builders by casting `TPayload` back to `TSlice` — precedent that the
  replace body carries the full next-state rows, which Phase 2's
  optimistic apply leans on.
- **F-10 — One command surface is different.** Aperture grid edits go
  through `POST /apertures/command` (one command per request), not the
  slice-replace path. Everything else (Rooms, Spaces, Equipment tabs,
  Thermal Bridges, Catalogs via slices, …) rides
  `createTableSliceFeature`.

## 3. Goals

- **G-1:** N rapid same-table gestures (Shift-Enter ×5, fast
  cell-tab-cell entry, paste bursts, rapid ⌘Z) all succeed with zero
  user-visible errors, in order, single-tab. (Fixes S-1.)
- **G-2:** Committing a cell frees the cursor in ≤ one frame
  (perceptually instant); the network catches up in the background.
  (Fixes S-2.)
- **G-3:** ⌘Z / ⌘⇧Z reliably undo/redo the basic ops — cell write,
  clear, paste, fill, row insert/delete/duplicate — with a useful
  history depth. 100% coverage NOT required (S-3 scope).
- **G-4:** Conflict errors are truthful: rapid-entry races never claim
  "another tab"; genuine cross-tab/user conflicts still surface and
  block cleanly.
- **G-5:** Server p50 write latency measurably reduced *if* metrics
  after G-1/G-2 show it still matters (measure-gated).

## 4. Non-goals

- **NG-1:** No redesign of the JSONB-document model, drafts, or the
  etag concurrency contract (reaffirmed 2026-06-24 review). The etag
  remains the cross-editor guard.
- **NG-2:** No per-cell/delta REST endpoints, no CRDTs/OT, no
  WebSockets. Whole-slice replace stays the write primitive.
- **NG-3:** No cross-session/persistent undo; per-table-mount history
  is acceptable.
- **NG-4:** Aperture command-path tables — follow-up, not this packet.
- **NG-5:** No offline mode. If the network is down, writes fail
  visibly after the queue's failure handling; we do not persist queues.
- **NG-6:** MCP/agent write surface (`replace_table` etc.) unchanged.

## 5. Design overview

The target pipeline (phases 01+02 together):

```
gesture → dispatchWrite(op, inverse)
  → validate + apply optimistically to the cached slice   (instant)
  → resolve commit() → cursor moves                        (instant)
  → enqueue op on the per-table FIFO write queue
      queue pump (one request in flight per table):
        coalesce adjacent same-kind queued ops
        build payload from freshest slice (query cache, not closure)
        PUT with If-Match = last server-acked etag
        on ack: applyAcceptedSlice + re-apply overlay of still-queued ops
        on 409/error: drain queue, refetch, clear history, honest banner
  → history.push({op, inverse}) per gesture (not per request)
```

Single-writer + serial queue + authoritative server response = the
cache always converges to the server's slice; the etag chain never
breaks single-tab; cross-tab conflicts still 409 exactly as today.

## 6. Decisions

- **D-1 — Parent-owned, uniform.** All fixes land in the shared layers
  (`useGridWriteReducer`, `useSliceTableController`,
  `table-slice.ts`). Every slice-backed table gets the behavior at
  once; no per-table opt-in/opt-out (DataTable-uniformity rule).
- **D-2 — Queue scope: per table-controller instance.** One FIFO per
  mounted slice-table controller, serializing ALL write kinds for that
  table: cell/paste/fill, row insert/delete/duplicate, schema
  mutations, legacy option replace, preview-replace preflights, and
  undo/redo replays. Cross-table writes stay concurrent (they conflict
  only at the draft etag — see D-2a).
  - **D-2a (investigate in Phase 1):** the draft etag is
    per-document, not per-table, so two *different* tables' writes can
    also race. Today that requires editing two tables inside one RTT
    (rare; sibling slices are stale-marked and refetch-before-write
    covers cross-render gaps). Phase 1 must confirm whether the queue
    should be **per project-version draft** (one queue spanning all
    tables) instead of per table. Default recommendation: per-draft
    queue keyed by `(projectId, versionId)` in a small module-level
    registry, since it is strictly safer and no harder to build.
- **D-3 — Execution-time payload building.** Payloads are built at
  dequeue time from the freshest slice read via
  `queryClient.getQueryData(editorSliceQueryKey)` (falling back to the
  closure `slice`), never from a stale render closure (F-6).
  `If-Match` always uses the **last server-acked** etag.
- **D-4 — Coalescing.** While a request is in flight, adjacent queued
  same-kind ops merge: `cell`+`cell` concatenate `CellWrite[]` (+ merge
  option deltas), `rowInsert`+`rowInsert` concatenate rows. Mixed kinds
  stay separate requests, in order. History remains **per gesture** —
  coalescing changes transport, not undo granularity.
- **D-5 — Optimistic apply via a slice-level applier.** Add ONE new
  required builder to `SlicePayloadBuilders`:
  `applyOp(slice, op, build): TSlice` (or equivalent — Phase 2 may
  derive it from the existing builders given F-9, e.g. by having
  builders return the next slice and mapping slice→payload once).
  Implementation must ship a shared generic helper for the standard
  table-envelope shape so per-table code is a one-liner; a table
  without a correct applier is a build error, not a silent downgrade
  (D-1).
- **D-6 — Failure semantics: drain, refetch, clear, tell the truth.**
  On any server rejection of a queued write: reject that op and all
  queued ops behind it, drop the optimistic overlay, refetch the
  authoritative slice, **clear the undo/redo history for that table**
  (inverses may no longer be valid), and show a banner whose copy
  matches the actual cause (Phase 4). Data loss on genuine conflict is
  bounded to un-acked keystrokes and is the same loss the user sees
  today — but now reported honestly.
- **D-7 — Ack-side effects stay ack-side.** `markLocalDraftTouched`,
  draft-summary invalidation, sibling-slice staling, and the Rooms
  broadcast (`onAcceptedSlice`) continue to fire on server ack only —
  never optimistically.
- **D-8 — Undo capacity 8 → 50**, undo/redo replay through the same
  queue/dispatch path, and history clears on conflict/refetch (D-6) and
  on version change (already: `clear` exists).
- **D-9 — One-shot self-heal on 409 (narrow).** After the queue exists,
  a residual 409 means a genuine cross-tab/remote edit. For **additive
  or row-scoped** ops only (cell writes and row inserts whose target
  rows still exist in the refetched slice), silently refetch → rebuild
  → resend **once**; otherwise (row deleted remotely, second failure,
  destructive op) fall through to D-6. Cell-level last-writer-wins on a
  refetched base preserves the other editor's unrelated changes and
  matches user intent.
- **D-10 — Backend trims are measure-gated and shape-preserving.**
  Phase 5 first extends the existing `project_document.saved` logging
  with parse/serialize/validate timings, then (if justified) adds a
  small process-local LRU of validated documents keyed by body
  etag/hash (immutable per etag — safe), sized in single digits with an
  explicit memory bound (8 MiB cap × N). No API or schema change.
- **D-11 — `isReplacePending` semantics change.** With a queue,
  "pending" means "queue non-empty OR request in flight". The exported
  `isReplacePending` (used to gate footer "+" etc.) must reflect that;
  audit its consumers in Phase 1.

## 7. Acceptance criteria

- **A-1:** Shift-Enter ×5 as fast as the keyboard repeats → 5 rows, no
  banner, ≤ ~2 PUTs typical (coalesced), correct final order. (G-1)
- **A-2:** Type value → Tab → immediately type in next cell, repeated
  across ≥10 cells at full typing speed: no dropped/blocked input, no
  errors, final slice on the server matches everything typed. (G-1, G-2)
- **A-3:** Cursor advance after commit ≤ 1 frame with network throttled
  to Slow-3G in devtools (write completes in background). (G-2)
- **A-4:** ⌘Z ×5 rapid after a burst of edits restores the prior state
  step-by-step, no errors; ⌘⇧Z replays. Cell write, clear, paste, fill,
  row insert/delete/duplicate each verified undoable. (G-3)
- **A-5:** Two-tab conflict drill (same table edited in both) still
  produces the draft-conflict banner in the losing tab — with copy that
  no longer fires for single-tab rapid entry, and the losing tab's
  history is cleared. (G-4)
- **A-6:** No regression in: draft summary badge behavior, Rooms
  broadcast sync, sibling-table stale-marking, save/discard-draft flow,
  version-locked handling, MCP `replace_table` parity.
- **A-7 (Phase 5, if run):** logged p50 server time for a 1-cell write
  on the largest seeded project reduced ≥ 30% vs. the pre-phase
  baseline, `make ci` green, zero API change.

## 8. Risks & mitigations

- **R-1 — Optimistic rollback surprises.** A genuine conflict now rolls
  back cells the user believed saved. Mitigation: D-6's banner names
  what happened + the refetched slice is visibly restored; bounded to
  un-acked ops; two-tab drill in acceptance (A-5).
- **R-2 — Overlay/ack interleaving bugs** (server ack clobbering
  optimistic state of still-queued ops). Mitigation: single pump per
  queue, `lastAcked + fold(queued ops)` recompute on every ack, unit
  tests for the interleavings (Phase 2 §test-matrix).
- **R-3 — Undo inverses vs. optimistic world.** Inverse ops were
  captured against the pre-op slice; replays go through the same queue
  so ordering holds, and D-6 clears history whenever the base is
  invalidated. Residual risk accepted for v1 (S-3 says basic coverage).
- **R-4 — Hidden `onWrite` callers.** Modal editors
  (RecordDetailModal), option editors, custom-field flows, and cascade
  preflights all funnel through `onWrite`/`runWithConflictHandling`;
  Phase 1 includes an audit so nothing bypasses the queue.
- **R-5 — Backend LRU memory.** Bounded count × 8 MiB cap; explicit
  budget in Phase 5; cache is read-through only, keyed by content hash.

## 9. Verification strategy (applies to every phase)

- Unit: queue serialization, coalescing rules, failure-drain, overlay
  recompute, history capacity/clearing (`vitest`, colocated with the
  hooks; extend `sharedEditContract.test.ts` so the contract is
  enforced for every table).
- Browser: Playwright rapid-entry smoke (A-1/A-2 scripted with
  `browser_press_key` bursts), Slow-3G cursor check (A-3), two-tab
  conflict drill (A-5). Sign in per `context/ENVIRONMENT.md`; seeded
  project data is owned by ed@example.com (see memory note) — smoke
  against a codex-owned scratch project or the agent fixture.
- `make ci` + closeout gate per repo CLAUDE.md for every phase.
