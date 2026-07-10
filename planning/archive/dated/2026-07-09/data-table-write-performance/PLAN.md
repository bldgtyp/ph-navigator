---
DATE: 2026-07-09
TIME: -
STATUS: Complete — all seven phases (00-06) landed or reached their
  documented measurement stop condition on 2026-07-09.
AUTHOR: Claude (for Ed); sequence per Codex plan review
SCOPE: Implementation sequence and dependency map; who ships what, in
  what order.
RELATED:
  - PRD.md (contract; read first) · plan-review.md (review of record)
  - phases/phase-00 … phase-06
---

# PLAN — Sequencing

## Order and rationale

```
phase-00  observability + write-surface audit   ← cheap, de-risks everything
phase-01  draft write coordinator (serialize)   ← fixes S-1; no coalescing
phase-02  per-table optimistic journals         ← fixes S-2; needs 01
phase-03  transport coalescing                  ← optional; needs 02 + F-15/F-16 algebra
phase-04  undo polish                           ← needs 01 (02 makes it feel instant)
phase-05  conflict copy + three-way retry       ← needs 01 (02 for base-value data)
phase-06  backend write-path trims              ← gated on phase-00 measurements
```

- **00 first**: the backend stage timings (which the old plan deferred
  to the last phase) also inform *whether* phase-06 happens and how
  much coalescing matters; the write-surface inventory de-risks R-D;
  the deterministic delayed-request test harness is reused by every
  later phase.
- **01 → 02 hard dependency.** Optimistic UI without serialization
  worsens etag races.
- **03 is explicitly droppable.** If post-02 measurement shows queue
  drain keeps up with real typing without merging PUTs, skip it (PRD
  D-4). Do not build the R-5/R-6 algebra speculatively.
- **04 and 05 are independent of each other**; both need 01. 05's
  three-way precondition consumes the observed-base values that 02's
  journal keeps, so run it after 02.
- **06 last**, driven by phase-00 numbers (the dominator may be the
  outgoing whole-doc validation — F-7 — which the originally-proposed
  input cache would not have touched).

## Landing strategy

Worktree-chain branches, one per phase. Recommended merges to `main`
(production deploys):

- 00 alone (pure instrumentation + tests).
- 01+02 together — 01 alone changes error behavior but leaves the
  latency feel unchanged; the user-visible payoff needs both.
- 03 (if kept), 04, 05, 06 individually.

Every merge passes the repo closeout gate.

## Per-phase one-liners

0. **phase-00** — Backend write-path stage timings aggregated at the
   write spine; frontend write-surface inventory on current main;
   deterministic delayed-request test utilities; baseline capture.
1. **phase-01** — Draft write coordinator: one FIFO transport lane per
   open draft; `WriteHandle {accepted, settled}` (settled == accepted
   until phase-02); `flush()`/`cancel()`/`whenIdle()`; lifecycle wiring
   (Save/Discard/switch/unload); every slice/schema/modal/preflight
   mutation routed; no coalescing; UX latency unchanged.
2. **phase-02** — Per-slice optimistic journals: R-1 invariant
   (transport = acked base + in-flight batch only; render = base + all
   outstanding); `accepted` resolves at optimistic apply → instant
   cursor; D-7 ack split so the pump never waits on ancillary work;
   rollback + honest rejected-count banner.
3. **phase-03** — Coalescing as a defined algebra: same-anchor
   row-insert order preservation, option-delta union/precedence,
   per-gesture history across merged batches. Keep only if measurement
   demands it.
4. **phase-04** — Undo polish: capacity 8→50, lineage-clear audit,
   burst-safe replay through the coordinator, per-kind inverse
   round-trip tests.
5. **phase-05** — Honest conflict copy on the two 409 codes + one-shot
   self-heal gated by the three-way precondition (no silent same-cell
   overwrite).
6. **phase-06** — Act on the measured dominator from phase-00 (cache
   with D-10 keys, or restructure the redundant outgoing validation);
   re-measure; stop when A-7 met or evidence says stop.

## Hand-off contract

Each phase doc is executable by an implementation agent given: the
phase doc + PRD.md + repo guides (`frontend/.instructions.md` /
`backend/.instructions.md`, `context/CODING_STANDARDS.md`,
`context/technical-requirements/data-table.md`). Every phase ends with
the closeout gate and a STATUS.md update in this packet.
