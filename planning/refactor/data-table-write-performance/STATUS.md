---
DATE: 2026-07-09
TIME: -
STATUS: Active — Phases 00-03 complete; Phase 04 is next.
AUTHOR: Claude (for Ed)
SCOPE: Live state ledger for the DataTable write-performance refactor.
RELATED:
  - README.md (router) · plan-review.md · PRD.md · PLAN.md · phases/
---

# STATUS — DataTable Write Performance

## Current state

- 2026-07-09 — Research complete (write path mapped with file:line
  evidence). Initial packet drafted (5 phases). **No code changes.**
- 2026-07-09 — Codex architecture review (`plan-review.md`) against
  main @ `79f73eb4`: ten required corrections + scope corrections.
- 2026-07-09 — **Packet revised; every review item verified against
  code and resolved.** Restructured to seven phases (00-06). Resolution
  map:

| Review item | Resolution |
|---|---|
| R-1 double-apply | PRD §6 invariants + D-3; phase-02 §2.1 + test matrix (queued ops never in an earlier request body) |
| R-2 two-layer split | PRD D-2 (coordinator + per-slice journals); phase-01 §2.1 / phase-02 §2.1 |
| R-3 accepted/settled | PRD §6 WriteHandle; contract ships in phase-01 (settled==accepted), timing changes in phase-02; A-9 |
| R-4 lifecycle flush/cancel | PRD D-12 + A-8; phase-01 §2.4 (useDraftLifecycle, VersionControls beforeunload keyed on non-idle) |
| R-5 insert-order reversal | Verified (splice at anchorIndex+1, spaceTypesController.ts:84-95) → F-15; phase-03 §2.2 anchor rewriting + contract test |
| R-6 option-delta algebra | F-16; phase-03 §2.3 + serial-execution oracle; coalescing deferred to its own conditional phase (D-4) |
| R-7 three-way retry precondition | PRD D-9 (observed-base equality, no silent same-cell overwrite); D-6 rejected-op counts; recovery buffer deferred v1.1 |
| Scope 3.1 catalogs | Verified (Materials = parallel row PATCHes) → F-10 corrected; scope renamed to project-document slice-backed tables; NG-7 follow-up |
| Scope 3.2 canonical contract | Verified (data-table.md:517-528 pre-ratifies queue/optimistic/flush/rollback) → F-11; PRD decisions marked [contract] |
| R-8 etag/cache keys | Verified (draft etag = sha256(etag:uuid4)) → F-12; phase-06 §3 keys |
| R-9 full-path instrumentation | Verified (third full-doc validate in tables/*.py, e.g. rooms.py:386) → F-7 expanded; phase-00 §2 aggregates at write spine |
| R-10 ack-effect stall | F-13; PRD D-7; phase-02 §2.4 split |
| §5 sequence | PLAN.md adopted (00-06); coalescing conditional; backend last |
| §6 alternatives | PRD D-13 (TanStack scope.id investigate in phase-01; command endpoint recorded + deferred in NG-2) |

  Deliberate scoping deviations from the review (not disagreements of
  substance): frontend queue metrics ride WITH phase-01 dev logging
  rather than a standalone telemetry step; the failed-op recovery
  buffer is optional/v1.1; lifecycle edge cases (auth change, unmount)
  get simple cancel+banner semantics, not recovery.
- 2026-07-09 — **Phase 00 complete.** Added the
  `project_document.write_timing` event with every planned stage/byte
  field, audited all scoped frontend write surfaces, added a
  controllable async transport/burst/unhandled-rejection harness with
  two current-behavior characterization tests, and captured the
  1,000-row PERF-STRESS baseline (50 cell writes + 10 inserts).
- 2026-07-09 — **Phase 01 complete.** All project-document table,
  modal, schema, and preview writes now share one FIFO transport lane
  per open draft. Save/Save As flush it; Discard cancels queued work
  and waits for the in-flight request. The live Pumps burst + Save
  drill proved one request in flight and correct lifecycle ordering.
- 2026-07-09 — **Phase 02 complete.** Per-slice optimistic journals
  now separate early local acceptance from server settlement, build
  transport payloads from the last ack only, rebase queued operations,
  and perform counted rollback with history clear. The 350 ms-latency
  browser drill rendered ten inserts ahead of a six-request backlog.
- 2026-07-09 — **Phase 03 complete.** The measured gate passed and
  adjacent queued cell/row-insert gestures now coalesce without
  crossing hard-operation or flush boundaries. Ten optimistic inserts
  settled in two PUTs at 2.5 s simulated latency, one request in flight.

## Next step

1. Implement Phase 04: history capacity, lineage-clear audit,
   burst-safe replay failure handling, and inverse coverage.

## Blockers

- None. Planning gate cleared pending ratification.

## Phase ledger

| Phase | Status |
|---|---|
| 00 — observability + write-surface audit | **Complete** |
| 01 — draft write coordinator | **Complete** |
| 02 — per-table optimistic journals | **Complete** |
| 03 — transport coalescing | **Complete** |
| 04 — undo polish | Planned |
| 05 — conflict copy + three-way retry | Planned |
| 06 — backend write-path trims | Planned (measure-gated) |

## Verification evidence

- Phase 00 focused backend + frontend tests green.
- PERF-STRESS baseline: 1,000 Rooms rows, 1.657-1.660 MiB body;
  single-cell `request_ms` p50/p95 = 368.511/438.328; row-insert
  p50/p95 = 360.913/442.479.
- Full `make format && make ci` recorded at phase closeout.
