---
DATE: 2026-07-09
TIME: -
STATUS: Complete — acceptance contract implemented through Phase 05;
  Phase 06 reached its documented measurement stop condition on
  2026-07-09.
AUTHOR: Claude (for Ed); revisions incorporate Codex plan review
SCOPE: Behavior + architecture contract for making project-document
  slice-backed DataTable data-entry keep up with the user: a draft
  write coordinator + per-table optimistic journals, reliable ⌘Z,
  honest conflict errors, and measure-gated backend trims.
RELATED:
  - plan-review.md (Codex architecture review this revision resolves)
  - context/technical-requirements/data-table.md §Persistence (canonical
    pre-ratified contract: FIFO queue, optimistic apply, flush, rollback)
  - frontend/src/shared/ui/data-table/hooks/useGridWriteReducer.ts (dispatch chokepoint)
  - frontend/src/shared/ui/data-table/feature/useSliceTableController.ts (onWrite, resolveSliceForWrite)
  - frontend/src/features/project_document/table-slice.ts (PUT + If-Match + applyAcceptedSlice)
  - frontend/src/features/project_document/hooks/useDraftLifecycle.ts (save/discard — no queue integration yet)
  - backend/features/project_document/write_spine.py + validation.py + tables/*.py
  - planning/archive/dated/2026-06-29/equipment-draft-etag-coordination/ (prior art)
---

# PRD — DataTable Write Performance & Undo

## 1. Problem statement

Production data-entry outruns the write pipeline:

- **S-1 (errors under rapid entry):** Shift-Enter ×5 to add 5 rows
  fails after ~2 with a false "draft changed in another tab" banner.
- **S-2 (pause between cells):** after committing a cell there is a
  noticeable delay before the next cell accepts input.
- **S-3 (undo):** ⌘Z should reliably undo basic table operations
  (write / edit / clear / paste, row insert/delete).

## 2. Scope

This packet covers the **project-document slice-backed DataTables** —
the 14 editable tables riding `createTableSliceFeature` /
`useSliceTableController`: Rooms, Space Types, Thermal Bridges, the
seven standard Equipment tables, and the four Heat Pump leaf tables.

Out of packet (recorded follow-ups, see NG-4/NG-7):

- **Aperture grid** — command endpoint (`POST /apertures/command`).
- **Catalog DataTables** (Materials, Frame Types, Glazing Types) — they
  use row-level catalog APIs with custom controllers (e.g. Materials
  groups cell writes by row and fires **parallel PATCHes**,
  `features/catalogs/materials/controller.ts:74,166`). They inherit the
  blocking `onWrite` promise and have their own race surface — a
  sibling effort, not this one.

## 3. Current-state findings

Verified 2026-07-09 against `main @ 79f73eb4` (F-1…F-9 originally
against `16bf1b16`, re-checked; F-10 corrected and F-11…F-16 added per
plan review).

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

- **F-1 — Whole-table writes.** No per-cell/per-row endpoint on this
  path. A one-cell edit and a row insert both `PUT` the entire table
  envelope (`table-slice.ts:68-82`; backend `routes.py:121-137` →
  `drafts.py:48-77`).
- **F-2 — No optimistic update.** No `onMutate` in the write path; the
  cache updates only from the server response in `applyAcceptedSlice`
  (`table-slice.ts:190-223`).
- **F-3 — Cursor blocks on the round-trip.** Enter/Tab move only inside
  `edit.commit().then(...)` (`GridBody.tsx:494-496`), and `commit()`
  awaits the PUT. This is S-2. `commitInFlightRef`
  (`useGridEdit.ts:108,189,199,226`) *rejects* (not queues) re-entry.
- **F-4 — No client-side write serialization.** Shift-Enter is
  fire-and-forget (`useGridKeyboard.ts:142-147`); `insertRowBelow`
  (`DataTable.tsx:591-666`) has no in-flight guard on the PUT. Two
  writes inside one RTT carry the **same** `If-Match`; the backend
  row-lock serializes them, rotates the etag on the winner
  (`write_spine.py:99-105,190-199`), and 409s the rest
  (`draft_etag_mismatch`). This is S-1.
- **F-5 — The error message lies.** That 409 surfaces as "The <table>
  draft changed in another tab…" via `runWithConflictHandling` →
  `handleStaleDraftConflict` (`useSliceTableController.ts:205-262`) —
  wrong for the single-tab rapid-entry case.
- **F-6 — Closure-staleness hazard.** `resolveSliceForWrite`
  (`useSliceTableController.ts:264-272`) returns the render-closure
  `slice` prop when the query isn't invalidated; correctness depends on
  a re-render landing between writes. Deferred (queued) execution must
  read state at execution time instead.
- **F-7 — Server cost scales with document, not edit.** Each write:
  whole-doc `SELECT … FOR UPDATE`; full Pydantic parse+migration of the
  saved version body (`write_spine.py:84`) and of the draft body
  (`write_spine.py:107`); **plus a third full-document validation of
  the outgoing body inside the table contract** —
  `validate_document(next_body.model_dump(mode="json"))` (e.g.
  `tables/rooms.py:386`, and equivalents in every table module);
  whole-doc canonical `json.dumps` + sha256 (`validation.py:35-45`);
  whole-doc JSONB upsert (`repository.py:93-137`); asset-reference
  check; ~3 DB transactions per request (session, access, write spine).
  8 MiB doc cap (`config.py:73`). Only SQL time is instrumented today
  (`db_ms`, `repository.py:295-296`).
- **F-8 — Undo exists.** `useGridHistory` (capacity 8) +
  `useGridWriteReducer` pair every gesture with a semantic inverse;
  ⌘Z/⌘⇧Z bound (`useGridKeyboard.ts:113-119`, `DataTable.tsx:912-919`).
  Undo replays are normal blocking writes → rapid ⌘Z hits the S-1 race.
- **F-9 — Payloads are slice-shaped in practice.** `composePastePayload`
  (`feature/types.ts:87-100`) chains builders by casting `TPayload`
  back to `TSlice`.
- **F-10 (corrected) — Catalog tables are NOT on the slice path.**
  See §2. The original claim that Catalogs ride
  `createTableSliceFeature` was wrong.
- **F-11 — The canonical contract already mandates the target design.**
  `context/technical-requirements/data-table.md` §Persistence (:517-528)
  requires: a FIFO persistence queue per open draft with no concurrent
  same-table/draft writes; optimistic apply while the queue flushes;
  Save / Save As waiting for pending writes to flush; and on
  conflict / auth failure / locked version / backend validation
  failure: stop the queue, roll back to the last server-acknowledged
  snapshot, clear undo, hand control to the parent UI; undo local-only
  (no compensating requests after a conflict). This packet is the
  implementation plan for that pre-ratified contract — the earlier
  "decisions not yet user-ratified" framing was wrong for these items.
- **F-12 — Draft etags are not content hashes.** Saved-version etags
  are content hashes; draft etags are `sha256(f"{etag}:{uuid4()}")`
  (`validation.py:57-59`) — an opaque immutable revision token.
- **F-13 — Ack side effects can stall a serialized pump.**
  `applyAcceptedSlice` awaits draft-summary invalidation (network when
  active), sibling staling, and `onAcceptedSlice` broadcast work
  (`table-slice.ts:200-222`), and TanStack awaits async
  mutation-success callbacks before `mutateAsync` resolves — so a naive
  queue pump would wait on ancillary work before the next PUT.
- **F-14 — Lifecycle surfaces exist without queue awareness.**
  `useDraftLifecycle.ts` (save / save-as / discard / switch) has no
  notion of pending writes; `VersionControls.tsx` already installs a
  `beforeunload` guard whenever a draft exists (so the question is
  wiring it to queue state, not adding one).
- **F-15 — Same-anchor row inserts splice-reverse.** Insert builders
  splice each new row at `anchorIndex + 1`
  (`spaceTypesController.ts:84-95` et al.), so two inserts naming the
  same anchor produce `anchor, B, A`. Rapid Shift-Enter can capture the
  same anchor until the render advances selection — any transport
  merging of inserts must handle this (F-15 kills naive concatenation).
- **F-16 — Option deltas don't merge shallowly.** `newOptions` /
  `removedOptions` are per-key maps; merging two gestures' deltas by
  key overwrite loses earlier additions; add-then-remove precedence is
  undefined without an explicit algebra.

## 4. Goals

- **G-1:** N rapid same-draft gestures (Shift-Enter ×5, fast
  cell-tab-cell entry, paste bursts, rapid ⌘Z) all succeed, in gesture
  order, with zero user-visible errors, single-editor. (S-1)
- **G-2:** Committing a cell frees the cursor in ≤ one frame; the
  network catches up in the background. (S-2)
- **G-3:** ⌘Z / ⌘⇧Z reliably undo/redo the basic ops with useful
  depth; 100% coverage not required. (S-3)
- **G-4:** Conflict errors are truthful, and lifecycle actions (Save,
  Save As, Discard, version switch, unload) are safe against pending
  writes — flush or cancel, never interleave or silently drop.
- **G-5:** Server p50 write latency measurably reduced *if* Phase-00
  measurement shows a cacheable/removable dominator (measure-gated).

## 5. Non-goals

- **NG-1:** No redesign of the JSONB-document model, drafts, or the
  etag concurrency contract (reaffirmed 2026-06-24 review).
- **NG-2:** No delta/CRDT/OT protocol and no WebSockets in this packet.
  An **ordered semantic-command endpoint**
  (`POST /draft/tables/{table}/commands` carrying `WriteOp[]`,
  rebasing under the backend row lock — aperture commands as prior
  art) is a real alternative that would shrink payloads and move the
  merge algebra server-side; it is **recorded and deferred**, not
  rejected: the frontend coordinator/journal work is needed for
  instant-cursor UX either way, and the endpoint can slot in later as
  a transport swap. (Plan-review §6.2.)
- **NG-3:** No cross-session/persistent undo.
- **NG-4:** Aperture command-path tables — follow-up.
- **NG-5:** No offline mode; queues are not persisted.
- **NG-6:** MCP/agent write surface (`replace_table` etc.) unchanged.
- **NG-7:** Catalog DataTables (row-level PATCH controllers) — recorded
  follow-up: optimistic row mutation / batching / invalidation for
  Materials, Frame Types, Glazing Types.

## 6. Design overview

Two layers (plan-review R-2), per the canonical contract:

```
┌─ Draft write coordinator ── one per open draft (projectId:versionId)
│   owns: the single transport lane (one request in flight, FIFO),
│         ordering across ALL tables of the draft, flush()/cancel(),
│         failure fan-out, lifecycle integration, status observability
│   schedules typed tasks WITHOUT knowing table slice shapes
│
└─ Per-slice optimistic journal ── one per mounted table controller
    owns: that table's query key, lastAcked slice, in-flight batch,
          queued ops, applier, overlay recompute, rollback
```

State invariants (plan-review R-1 — the core correctness rule):

```
transport candidate = apply(current in-flight batch ONLY, lastAcked)
rendered slice      = apply(in-flight batch + queued ops, lastAcked)

on ack:   lastAcked = server response; drop acked batch;
          rendered = apply(remaining queued ops, lastAcked)
on fail:  drop journal; rendered = lastAcked (or refetched slice);
          reject queued ops; clear history; surface honest error
```

Later queued operations must NEVER appear in an earlier request body
(tests must prove this — it is what prevents double-apply of row
inserts and option mutations).

Write lifecycle contract (plan-review R-3):

```ts
type WriteHandle = {
  accepted: Promise<void>; // optimistic apply done; cursor may move
  settled: Promise<void>;  // server ack or rejection
};
```

The grid awaits `accepted`; the controller ALWAYS observes `settled`
(classify conflict, drain/rollback, clear history, set
`editBlocker`/`actionError`). No detached/unhandled background
rejections.

Sequencing (plan-review §5): serialization lands **without**
coalescing; journals land next; coalescing (with the R-5/R-6 algebra)
only after both are proven; self-heal retry and backend trims last.

## 7. Decisions

Items marked **[contract]** restate `data-table.md` §Persistence and
are pre-ratified; the rest are this packet's proposals.

- **D-1 — Parent-owned, uniform.** All frontend changes land in the
  shared layers; every slice-backed table gets the behavior at once; no
  per-table opt-out. (DataTable-uniformity rule.)
- **D-2 — Two-layer concurrency model.** [contract, refined] One
  **draft write coordinator** per open draft (module-level registry
  keyed `projectId:versionId`; lifetime tied to subscribed controllers)
  owning the single FIFO transport lane — the draft etag is
  document-scoped, so this also closes the cross-table race. One
  **optimistic journal per mounted slice controller** owning per-table
  state. The coordinator never sees `TSlice` generics (multiple
  unrelated slice types mount concurrently on Equipment/Heat-Pumps
  pages).
- **D-3 — Transport from acked base + current batch only.** Payloads
  are built at dispatch time by the journal from `lastAcked` + the
  in-flight batch, never from the rendered optimistic slice (R-1).
  `If-Match` always carries the coordinator's last server-acked draft
  etag. The rendered query-cache slice is a VIEW
  (`apply(all outstanding, lastAcked)`), never a payload source.
- **D-4 — Coalescing is deferred to its own phase and specified as an
  algebra.** Serialization ships first with **no** coalescing (each
  gesture = one PUT, strictly ordered). The coalescing phase must
  define and test: same-anchor row-insert order preservation (rewrite
  subsequent inserts to anchor on the previously inserted row, or fix
  the shared splice algorithm — F-15); option-delta union by id with
  explicit add/remove precedence (F-16); per-gesture history preserved
  across merged transport batches. If measurement after phases 01-02
  shows queue drain is fine without it, coalescing may be dropped.
- **D-5 — Applier shape decided by audit.** The journal needs
  `applyOp(slice, op, build): TSlice`. Prefer deriving it from the
  existing payload builders (F-9 precedent) iff the audit confirms
  every table's `TPayload` merges losslessly into `TSlice`; else add a
  required builder with a shared generic default. Compile-enforced,
  uniform (D-1).
- **D-6 — Failure semantics.** [contract] On conflict / auth failure /
  locked version / backend validation failure: stop the queue, roll
  back to the last server-acknowledged snapshot (or refetched slice),
  reject all queued ops, **clear undo history**, hand control to the
  existing banner/blocker UI. Copy must state **how many operations
  were rejected** — with optimistic UI the backlog can exceed one
  keystroke, which is *more* potential unsaved work than today's
  blocking UI permits (plan-review R-7 note); the honest count is the
  v1 mitigation. A recoverable failed-op buffer is **optional /
  deferred** (v1.1 candidate), not required.
- **D-7 — Ack handling split (R-10 / F-13).** On settle-success, do
  synchronously: install accepted slice into the journal
  (`lastAcked`), advance the coordinator etag, mark siblings
  invalidated (`refetchType:"none"` — no network). Do WITHOUT blocking
  the next dequeue: draft-summary refresh (prefer patching its cache
  from response data + background invalidate) and `onAcceptedSlice`
  broadcasts. `markLocalDraftTouched` stays ack-side.
- **D-8 — Undo capacity 8 → 50**; undo/redo replays route through the
  coordinator; history clears on every lineage-replacing event (D-6,
  remote broadcast apply, reload, version switch). [contract: undo is
  local-only; no compensating requests after conflict.]
- **D-9 — Self-heal retry requires a three-way precondition (R-7).**
  At most one transparent retry, only when ALL hold: error is
  `draft_etag_mismatch`; op is `cell`/`fill`/`rowInsert`; refetched
  authoritative slice shows every targeted row still exists (and no
  id collision for inserts); AND for cell-valued ops the remote
  current value of each targeted cell equals the op's **observed base
  value** (available from the gesture's inverse op). If the same cell
  changed remotely → no silent last-writer-wins; surface the conflict.
- **D-10 — Backend trims are measure-gated on FULL-path timings.**
  Phase-00 instruments the whole write path aggregated at the
  write-spine/service layer (not the repository): version parse, draft
  parse, payload parse, contract application, **outgoing whole-doc
  validation (F-7 third parse)**, asset check, serialize/hash, SQL,
  response construction, total txn/request, request/response bytes.
  Cache keys use available identifiers, not recomputed hashes: saved
  body `(version_id, updated_at)` or version etag; draft body
  `(version_id, user_id, draft_etag)` — draft etags are opaque
  revision tokens, NOT content hashes (F-12). Act on the measured
  dominator, which may be the outgoing validation an input-cache
  wouldn't touch.
- **D-11 — `isReplacePending` means "journal not idle".** Queue
  non-empty OR request in flight; audit consumers.
- **D-12 — Lifecycle integration is a first-class deliverable (R-4).**
  [contract for Save/Save As] The coordinator exposes `flush()`,
  `cancel()`, `whenIdle()`, and observable status. Required wiring:
  Save / Save As / save-and-switch → `flush()` (success required)
  before the version endpoint; Discard / discard-and-switch →
  `cancel()` + journal drop before deleting the server draft; version
  change, lock change, auth/session change, controller unmount →
  simple, specified semantics (default: cancel + D-6 messaging — do
  not build elaborate recovery for these edges); queue failure while a
  lifecycle action awaits `flush()` → the action aborts with the D-6
  error. `VersionControls.tsx`'s existing `beforeunload` guard keys on
  coordinator non-idle in addition to draft existence.
- **D-13 — Alternatives evaluated (plan-review §6).** (a) TanStack
  mutation `scope.id` serialization: investigate in phase-01 as the
  transport-lane primitive; it provides serial dispatch only — no
  coalescing hooks, journals, flush/cancel, or lifecycle coordination —
  so the coordinator exists regardless; adopt it inside the
  coordinator only if it simplifies. (b) Ordered semantic-command
  endpoint: recorded + deferred per NG-2.

## 8. Acceptance criteria

- **A-1:** Shift-Enter ×5 at keyboard-repeat speed → 5 rows in gesture
  order, no banner. (Pre-coalescing: 5 serialized PUTs is fine; the
  order requirement is the point.)
- **A-2:** Type → Tab → type across ≥10 cells at full speed: no
  dropped/blocked input, no errors, server final state matches.
- **A-3:** Cursor advance after commit ≤ 1 frame with network throttled
  to Slow-3G (write completes in background).
- **A-4:** ⌘Z ×5 rapid restores state step-by-step; ⌘⇧Z replays; cell
  write, clear, paste, fill, row insert/delete/duplicate each verified.
- **A-5:** Two-tab conflict drill: losing tab gets a truthful banner
  (with rejected-op count), rolls back to authoritative state, history
  cleared; same-cell remote change is NEVER silently overwritten.
- **A-6:** No regression in: draft summary badge, Rooms broadcast,
  sibling staling, save/discard flows, version-locked handling, MCP
  `replace_table` parity.
- **A-7 (backend phase, if run):** measured p50 server time for a
  1-cell write on the largest fixture reduced ≥ 30% vs the Phase-00
  baseline; zero API change; instrumentation retained either way.
- **A-8 (lifecycle):** with ops still queued: Save waits and then saves
  the flushed state (draft GET proves it); Discard cancels cleanly with
  no post-discard PUTs (network log proves it); unload warns while
  non-idle; a flush failure aborts Save with the D-6 banner.
- **A-9 (transport correctness):** unit-proven — later queued ops never
  appear in an earlier request body; a settle-rejection is always
  observed by the controller (no unhandled rejections under
  `vitest` strict unhandled-rejection reporting).

## 9. Risks & mitigations

- **R-A — Optimistic rollback can discard a multi-op backlog** (bigger
  loss surface than today's blocking UI). Mitigation: rejected-op count
  in the banner (D-6), lifecycle flush gates (D-12), two-tab drill
  (A-5); failed-op recovery buffer deferred to v1.1.
- **R-B — Journal/coordinator interleaving bugs.** Mitigation: R-1
  invariant unit matrix (phase-02 §tests) written BEFORE controller
  wiring; deterministic delayed-request test harness from phase-00.
- **R-C — Undo inverses vs. rebased state.** Mitigation: D-8
  clear-on-lineage-change; per-kind round-trip tests (phase-04).
- **R-D — Hidden write entry points bypassing the coordinator.**
  Mitigation: phase-00 write-surface inventory on current main;
  contract test that overlapping `mutateAsync` calls are impossible.
- **R-E — Backend cache invisibility.** Mitigation: cache-hit ≡
  cache-miss property test; keys per D-10; bounded size via Settings.

## 10. Verification strategy

- Unit: coordinator serialization/flush/cancel; R-1 invariant matrix;
  failure drain + settled-observation (A-9); coalescing algebra (its
  phase); history capacity/clearing. Extend
  `sharedEditContract.test.ts` so every registered table inherits the
  guarantees (D-1).
- Browser (Playwright): A-1/A-2 keystroke bursts, A-3 Slow-3G, A-4 undo
  burst, A-5 two-tab drill, A-8 lifecycle drills. Sign in per
  `context/ENVIRONMENT.md`; use a codex-owned scratch project or the
  agent fixture (seeded project belongs to ed@example.com).
- `make ci` + repo closeout gate per phase.
