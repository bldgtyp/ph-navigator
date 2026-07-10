---
DATE: 2026-07-09
TIME: -
STATUS: Planned — CONDITIONAL. Depends on phase-02; build only if
  post-02 measurement shows queue drain lagging real data-entry.
AUTHOR: Claude (for Ed); algebra requirements per plan-review R-5/R-6
SCOPE: Implementation handoff for Phase 3 — merge backlogged journal
  ops into fewer transport requests, with defined row-insert ordering
  and option-delta algebra. Per-gesture history and per-gesture
  WriteHandles are preserved; only transport batches merge.
RELATED:
  - ../PRD.md §3 (F-15, F-16), §7 (D-4), §8 (A-1)
  - ../plan-review.md R-5, R-6, §5 step 4
  - phases/phase-02-optimistic-journals.md (the `inFlight` batch becomes >1 op here)
  - frontend/src/features/spaces/lib/spaceTypesController.ts:79-95 (anchor-splice reference)
---

# Phase 3 — Transport coalescing (conditional)

## 1. Entry gate

Skip this phase (record the numbers + decision in STATUS.md) unless
phase-02 verification shows user-perceivable backlog: e.g. sustained
typing keeps > ~3 ops queued, or Shift-Enter ×10 takes noticeably
longer to settle than a user pauses. With optimistic UI the user never
*waits* on drain; the motivations are burst throughput, server load,
and flush time before Save. Measure, then decide.

## 2. Design

Dequeue takes the whole eligible run of queued ops into one `inFlight`
batch (phase-02's structures already model a batch; this phase makes
its size >1). Transport payload = `applyOps(lastAcked, batch)` — the
R-1 invariant is unchanged; only batch size grows. Each gesture keeps
its own WriteHandle (all handles in a batch settle from that request's
outcome) and its own history entry.

### 2.1 Mergeable runs

Adjacent ops of the same table merge only within these kinds:

- `cell` + `cell`
- `rowInsert` + `rowInsert`
- `cell` + `rowInsert` interleavings MAY form one batch (the applier
  applies them in order — payload correctness comes from `applyOps`,
  not from kind-sorting). Everything else (paste, fill, delete,
  duplicate, schema mutations, option replace, preflights) is a batch
  boundary.

### 2.2 Row-insert ordering (R-5 / F-15)

Builders splice at `anchorIndex + 1`, so same-anchor inserts reverse
(`anchor, B, A`). Required: gesture order preserved. Choose ONE, apply
uniformly, and add a cross-table contract test:

- **(a) Anchor rewriting (recommended, no builder changes):** when
  batching, rewrite insert N+1's `anchorRowId` to insert N's `rowId`
  if they share the original anchor. Local to the coalescer.
- **(b) Shared splice-algorithm change:** make grouped same-anchor
  inserts append after the previously inserted row. Touches every
  builder's semantics — only if (a) proves insufficient.

Contract test (all 14 tables via the shared suite): 3 same-anchor
inserts → rows appear in gesture order under both single-op and
batched transport.

### 2.3 Option-delta algebra (R-6 / F-16)

Batching two `cell` ops must merge their `newOptions` /
`removedOptions` with defined semantics, tested property-style:

- additions: union by option id per field key (no array overwrite);
- removals: union per field key;
- add-then-remove of the same id within a batch → removed (and vice
  versa: remove-then-add → present);
- option order: preserve first-seen order (match what serial
  round-trips would produce — verify against a serial-execution oracle,
  see §3);
- inverses: untouched — per-gesture inverses were captured at accept
  time and remain valid because history is per-gesture.

## 3. The oracle test (the phase's keystone)

Property/table test: for a random-ish sequence of ops, final slice via
batched transport === final slice via one-request-per-op serial
transport (the phase-02 behavior). Run across every registered table
via the shared contract suite. If an op sequence can't satisfy the
oracle, it must be a batch boundary — encode that in §2.1 rather than
special-casing.

## 4. Step-by-step

1. Entry-gate measurement + decision (may end the phase).
2. Coalescer in the journal dequeue (batch assembly + anchor
   rewriting) — pure function, unit-tested first.
3. Option-delta merge with the §2.3 algebra.
4. Oracle test in the shared contract suite.
5. Re-run A-1 (now expect ≤ ~2 PUTs for 5 inserts), A-2, A-5; verify
   per-gesture undo still steps one gesture at a time.
6. Closeout gate.

## 5. Acceptance

- Oracle green for all tables; same-anchor ordering contract green;
  A-1 with reduced request count; per-gesture history preserved
  (⌘Z after a coalesced burst undoes one gesture, not one batch).

## 6. Notes

- Coalescing lives entirely journal-side; the coordinator still sees
  one opaque task per dispatch (R-2 intact).
- Do not merge across a flush() boundary — ops accepted after a flush
  call must not batch into the pre-flush request (keeps phase-02's
  flush semantics exact).
