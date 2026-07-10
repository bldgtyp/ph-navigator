---
DATE: 2026-07-09
TIME: -
STATUS: Draft — sequencing proposal matching PRD D-1…D-11.
AUTHOR: Claude (for Ed)
SCOPE: High-level implementation sequence and dependency map for the 5
  phases; who ships what, in what order, and what can run in parallel.
RELATED:
  - PRD.md (contract; read first)
  - phases/phase-01 … phase-05 (detailed handoffs)
---

# PLAN — Sequencing

## Order and rationale

```
phase-01  write queue + coalescing          ← unlocks everything; fixes S-1
phase-02  optimistic apply + instant cursor ← fixes S-2; needs 01's queue
phase-03  undo polish                       ← rides 01 (and benefits from 02)
phase-04  conflict messaging + self-heal    ← after 01; residual 409s only
phase-05  backend trims                     ← independent; gated on metrics
```

- **01 → 02 is a hard dependency.** Optimistic UI without serialization
  makes etag races worse, not better.
- **03 and 04 are independent of each other**; both need 01. Either can
  follow 02, or run in parallel with it on separate branches if 02's
  surface (`table-slice.ts`, controller) is coordinated — default:
  sequential, same branch chain, to keep the diff review simple.
- **05 is fully decoupled** (backend only, zero API change). Run it
  last, and only if the instrumentation it starts with says server time
  still dominates after 01+02. It may legitimately end at "measured;
  not worth it."

## Branch / landing strategy

- One feature branch per phase off the previous phase's branch
  (worktree-chain pattern), merged to `main` as each phase passes its
  gate — or accumulate 01+02 into one merge if 01 alone would ship a
  behavior users notice as "still slow but no longer erroring" for a
  long gap. Recommendation: land 01+02 together, then 03, 04, 05
  individually. `main` deploys production — each merge must pass the
  closeout gate.

## Per-phase one-liners (details in phases/)

1. **phase-01** — Serialize every slice-table write through a per-draft
   FIFO with same-kind coalescing; execution-time payload building from
   the query cache; failure drains the queue. UX still blocks on ack
   (unchanged feel except: no more rapid-entry errors).
2. **phase-02** — Commit resolves at optimistic-apply time; cursor
   moves instantly; overlay recompute on each ack; rollback + banner on
   failure. This is the perceived-latency fix.
3. **phase-03** — History capacity 8→50, clear-on-conflict, undo/redo
   through the queue, per-op-kind inverse coverage tests, ⌘Z burst
   smoke.
4. **phase-04** — Distinguish 409 causes in copy (drop the false
   "another tab"), one-shot self-heal for row-scoped ops per PRD D-9.
5. **phase-05** — Instrument parse/validate/serialize timings in
   `project_document.saved`; if justified: LRU of validated docs keyed
   by etag; re-measure; stop when A-7 met or evidence says stop.

## Estimated size (for scheduling, not commitment)

| Phase | Approx. touch | New tests |
|---|---|---|
| 01 | ~2 files core (new queue module + controller wiring) + audit | queue unit + contract extension |
| 02 | controller + table-slice + GridBody/useGridEdit + per-table appliers (mostly via shared helper) | overlay/interleaving unit + Playwright A-2/A-3 |
| 03 | history/reducer/keyboard, small | per-kind inverse tests + burst smoke |
| 04 | controller error path + copy constants | conflict-copy unit + two-tab drill |
| 05 | backend validation/write_spine/repository + logging | timing assertions + `make ci` |

## Hand-off contract

Each phase doc is written to be executable by an implementation agent
with: the phase doc + PRD.md + the repo guides
(`frontend/.instructions.md` / `backend/.instructions.md`,
`context/CODING_STANDARDS.md`). Every phase ends with the repo closeout
gate (simplify skill, docs-pass skill, `make format`, `make ci`) and
updates `STATUS.md` in this packet.
