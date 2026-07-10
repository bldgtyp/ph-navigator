---
DATE: 2026-07-09
TIME: -
STATUS: Planned — depends on phase-01 (residual 409s are genuine
  conflicts) and phase-02 (journals hold the observed base values the
  three-way check needs).
AUTHOR: Claude (for Ed); retry preconditions per plan-review R-7
SCOPE: Implementation handoff for Phase 5 — truthful conflict copy
  keyed to the actual 409 cause, and a narrowly-gated one-shot
  transparent retry with a three-way precondition. No silent same-cell
  last-writer-wins.
RELATED:
  - ../PRD.md §3 (F-5), §7 (D-6, D-9), §8 (A-5)
  - ../plan-review.md R-7, §5 step 6
  - frontend/src/shared/ui/data-table/feature/useSliceTableController.ts (runWithConflictHandling)
  - frontend/src/features/project_document/lib.ts (isDraftStaleError / isVersionLockedError)
  - frontend/src/shared/ui/data-table/feature/types.ts (ConflictMessages)
  - backend/features/project_document/write_spine.py:89-105 (the two 409 codes)
---

# Phase 5 — Honest conflict messaging + three-way-gated retry

## 1. Goal

After phase-01, a 409 means a **genuine** cross-editor change (another
tab, user, MCP agent, or save/version event). Say that truthfully with
the right cause, absorb only the conflicts that are provably safe to
absorb, and never silently overwrite another editor's change to the
same cell.

## 2. Work items

### 2.1 Structured classification + copy

Backend emits distinct codes (`write_spine.py:89-105`):
`draft_etag_mismatch` and `version_etag_mismatch`.

- Step 0: confirm the 409 body carries a machine-readable code; if
  not, add it as a strictly-additive field (mini backend change).
- Add `classifyDraftConflict(error)` beside `isDraftStaleError`;
  extend `ConflictMessages` with cause-specific variants; consolidate
  the per-table copy constants into shared defaults with table-name
  interpolation (audit how each table populates `conflictMessages`
  today — if it's copy-paste, centralize per D-1).
- Copy rules: only claim "another tab" with broadcast evidence (Rooms
  can pass that hint); otherwise "changed outside this view (another
  tab, editor, or agent)". Describe what we DID ("Reloaded the latest
  draft; N unsaved changes were discarded" — count from the D-6
  drain), not instructions to do what we already did.

### 2.2 One-shot transparent retry (D-9 / R-7)

In the journal failure path, BEFORE the D-6 drain, attempt exactly one
transparent recovery when ALL hold:

1. code is `draft_etag_mismatch` (never version mismatch, lock, auth,
   or validation);
2. the failed batch contains only `cell`, `fill`, `rowInsert` ops;
3. refetched authoritative slice: every targeted row still exists;
   inserts have no row-id collision;
4. **three-way precondition:** for every cell-valued write, the
   remote current value === the op's observed base value — sourced
   from the gesture's inverse (captured at accept time, which the
   journal already retains). If ANY targeted cell changed remotely →
   no retry, surface the conflict (never silent same-cell
   last-writer-wins);
5. this batch has not been retried before.

On pass: rebuild payload from the refetched slice (`applyOps(refetched,
batch)`), resend with the fresh etag, continue the queue on success —
user sees nothing (decide with Ed at review whether to add a subtle
toast; default silent). On any failure or unmet gate: standard D-6
drain + §2.1 banner.

Log every self-heal attempt/outcome through the frontend logging
channel for observability.

### 2.3 Verification drill

Two-tab Playwright drill (A-5): (a) tab B's queued cell write against
a row tab A didn't touch → silent self-heal, both edits present; (b)
tab B edits the same cell tab A changed → banner (with count), no
overwrite, refetched truth rendered, history cleared; (c) tab A
deleted the row tab B was editing → banner path.

## 3. Step-by-step

1. Backend 409 body audit (+ additive code field if needed).
2. `classifyDraftConflict` + `ConflictMessages` variants + copy
   consolidation sweep.
3. Retry in the journal failure path; unit tests for every gate
   (each of §2.2's five conditions toggled individually; max-1 retry;
   base-value mismatch → no retry).
4. Two-tab drill (§2.3).
5. Closeout gate.

## 4. Acceptance

- A-5 verbatim (including the never-overwrite clause); unit-proven
  gates; honest cause-specific copy for both 409 codes; rejected-op
  counts in every drain banner.

## 5. Notes

- Retry lives in the journal (it owns ops, base values, and the
  applier); the coordinator stays shape-blind; the controller keeps
  owning banner/blocker UX.
- MCP agents share the same draft row (one draft per version+user) —
  self-heal smooths agent+browser co-editing, but do not widen the
  gates for it.
