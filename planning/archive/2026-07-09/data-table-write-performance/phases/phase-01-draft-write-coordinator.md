---
DATE: 2026-07-09
TIME: -
STATUS: Complete — implemented and verified 2026-07-09.
AUTHOR: Claude (for Ed); architecture per plan-review R-2/R-3/R-4
SCOPE: Implementation handoff for Phase 1 — the draft write
  coordinator: one FIFO transport lane per open draft, WriteHandle
  accepted/settled contract, flush/cancel/whenIdle, and document
  lifecycle integration. NO coalescing, NO optimistic apply. Fixes S-1;
  latency feel intentionally unchanged until phase-02.
RELATED:
  - ../PRD.md §6 (design), §7 (D-1…D-3 minus optimism, D-11, D-12, D-13a), §8 (A-1, A-8, A-9)
  - ../plan-review.md R-2, R-3, R-4, §5 step 2
  - context/technical-requirements/data-table.md:517-528 (canonical contract)
  - frontend/src/shared/ui/data-table/feature/useSliceTableController.ts
  - frontend/src/features/project_document/table-slice.ts
  - frontend/src/features/project_document/hooks/useDraftLifecycle.ts
  - frontend/src/features/project_document/components/VersionControls.tsx (beforeunload)
  - phases/phase-00-… §3 inventory (the wiring checklist)
---

# Phase 1 — Draft write coordinator (serialization only)

## 1. Goal

Every write against one open draft — from any of its mounted tables,
schema mutations, modal saves, and preview preflights — goes through
one FIFO transport lane: strictly ordered, one request in flight,
each request carrying the etag from the previous response. Rapid
gestures stop 409ing (A-1). Lifecycle actions flush or cancel the lane
(A-8). Commit still resolves on server settle — the UX pause remains
(phase-02's job).

## 2. Design

### 2.1 Coordinator module

New `frontend/src/features/project_document/draftWriteCoordinator.ts`
(pure TS; no React):

```ts
type DraftWriteCoordinator = {
  schedule(task: TransportTask): WriteHandle; // FIFO; no type knowledge of slices
  flush(): Promise<void>;      // resolves when idle; rejects on drain failure
  cancel(): void;              // reject all queued (not in-flight) tasks
  whenIdle(): Promise<void>;   // passive
  status(): { queued: number; inFlight: boolean };
  subscribe(cb): unsubscribe;  // for isReplacePending / beforeunload / dev logging
};

type TransportTask = {
  run(): Promise<unknown>;     // built by the CALLER (typed layer); coordinator is shape-blind
  label: string;               // e.g. "rooms:cell" — dev logging + tests
};

type WriteHandle = { accepted: Promise<void>; settled: Promise<void> };
```

- **Registry:** module-level `Map<"projectId:versionId", …>`;
  created on first subscribe, disposed when drained AND unsubscribed
  (audit navigation paths so backlog is never dropped by unmount alone
  — unmount with queued work follows D-12 semantics).
- **This phase:** `accepted` resolves together with `settled`
  (no optimism yet) — but the two-promise contract ships NOW so
  phase-02 only changes *when* `accepted` resolves, not any caller's
  shape. Every `settled` rejection must be observed by the scheduling
  controller (R-3); add the strict unhandled-rejection assertion from
  phase-00's harness to the contract tests.
- **Failure drain:** in-flight rejection → reject that task's
  `settled` with the original error; reject all queued tasks with
  `WriteQueueDrainedError`; empty lane; stay usable for the next
  schedule. Controllers distinguish "my op failed" (classify via
  existing `isDraftStaleError`/`isVersionLockedError`) from "an earlier
  op failed" (show nothing extra; the first failure owns the banner).
- **No coalescing. No delay:** an idle lane dispatches immediately.
- **D-13a check:** before building the pump, spend ≤1h evaluating
  TanStack mutation `scope.id` as the lane primitive (phase-00
  confirmed availability). Adopt it inside the coordinator only if it
  genuinely replaces the pump without weakening flush/cancel/drain
  semantics; record the decision here either way.

### 2.2 Execution-time state (F-6)

Tasks build their payload inside `run()` at dispatch time:
`resolveSliceForWrite` changes to read
`queryClient.getQueryData(editorSliceQueryKey)` first (fallback:
closure slice; keep the `isInvalidated → refetch` branch). In this
phase the cache holds only server-acked slices, so cache-read ==
last-acked. (Phase-02 will move etag custody into the journal; the
D-3 "etag from coordinator's last ack" rule starts THERE — in this
phase the cache value is correct by construction.)

### 2.3 Controller wiring

`commitPayloadOrThrow`, `commitSchemaMutation`, and the
`previewReplace` preflight path schedule tasks instead of running
inline. `runWithConflictHandling` keeps owning classification/banner,
now driven by `settled`. Work through the phase-00 §3 inventory table
row by row; every entry point gets a routing decision (route, or a
written justification why not). Contract test: no two overlapping
`fetch`es to the same draft's write endpoints (extend
`sharedEditContract.test.ts` so all registered tables inherit it).

### 2.4 Lifecycle integration (D-12 / R-4)

- `useDraftLifecycle`: Save / Save As / save-and-switch call
  `flush()` first; flush failure aborts the action with the D-6
  banner. Discard / discard-and-switch call `cancel()` first.
- Version switch / lock-detected / auth-session change / unmount:
  `cancel()` + existing blocker messaging. Keep these edges simple —
  specified, tested, not clever.
- `VersionControls.tsx` beforeunload: warn when draft exists **or
  coordinator non-idle** (it's `settled`-lag aware in this phase only
  trivially; matters more after phase-02). Note the sun-study lesson:
  beforeunload wedges MCP browser-tab input — keep the condition
  narrow.
- `isReplacePending` := mutation pending OR lane non-idle (D-11);
  audit consumers (footer "+", modal save buttons).

## 3. Out of scope

Optimistic apply / instant cursor (02), coalescing (03), undo changes
(04 — note replays already serialize for free via `onWrite`), conflict
copy / retry (05), backend (06).

## 4. Step-by-step

1. Coordinator module + unit tests against the phase-00 harness
   (serialization order, drain, flush success/failure, cancel,
   registry lifetime, immediate-dispatch).
2. D-13a evaluation note.
3. `resolveSliceForWrite` cache-first change + regression test.
4. Controller wiring per inventory; contract test.
5. Lifecycle wiring + A-8 Playwright drills (save-while-queued,
   discard-while-queued, unload warning).
6. A-1 Playwright drill (Shift-Enter ×5 burst → 5 rows, ordered, no
   banner; also proves the phase-00 characterization test flipped).
7. Closeout gate.

## 5. Acceptance

- A-1 (5 PUTs, strictly ordered — coalescing not expected), A-8, A-9.
- A-6 regression list green. Phase-00 S-1 characterization now asserts
  the fix.

## 6. Notes

- The lane is per **draft**, not per table (etag is document-scoped);
  per-table ordering is a consequence. Keep the coordinator blind to
  slice types (R-2) — it schedules opaque `run()` thunks; all typed
  logic stays in the controller/journal layer.
- Rooms broadcast: a remote slice applied mid-backlog will 409 our
  next task — the drain path handles it; phase-05 improves the copy.
  No special-casing here.

## 7. As-built record (2026-07-09)

- Implemented an explicit shape-blind pump rather than TanStack mutation
  `scope.id`: the latter serializes mutations but does not supply the required
  shared registry lifetime, queue cancellation, failure drain, passive idle,
  or lifecycle flush semantics.
- The module registry is keyed by `projectId:versionId`. React's transient
  unsubscribe/resubscribe cycle is bridged by microtask-delayed disposal;
  live testing caught and fixed a split-lane race at this boundary.
- Individual table unmount does not cancel a shared draft lane. The last
  subscriber permits an existing backlog to drain before disposal. Save and
  Save As flush; Discard cancels queued work and waits for the in-flight write.
  Repeated lifecycle actions are guarded across the whole flush/cancel plus
  version-mutation transaction.
- `accepted` and `settled` are distinct handle promises but intentionally
  settle together in this serialization-only phase. Phase 02 changes the
  accepted boundary without changing caller shape.
- Every Phase-00 inventory bypass now has an explicit route: controller writes,
  Rooms modal writes, Ventilator and linked-ventilator modal writes, schema
  writes, and outdoor-unit delete preview use the draft lane. Execution-time
  slice resolution shares a cache-first, invalidation-aware helper.
- Focused verification: coordinator/controller/lifecycle/heat-pump tests (47
  passed). Live Pumps drill: Shift-Enter burst produced six ordered PUTs,
  `max_in_flight=1`, and Save began only after the last PUT response.
