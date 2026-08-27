---
DATE: 2026-08-26
TIME: 22:10 EDT
STATUS: Complete — all four phases merged to main 2026-08-27
AUTHOR: Claude with Ed May
SCOPE: Router for making specification-status editing responsive and
  batchable on the Envelope / Materials and Apertures spec-report tables,
  by adopting the write journal that already ships behind DataTable.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ./decisions.md
  - ../../../context/ui/pages/envelope-tab.md
  - ../../../context/ui/pages/apertures-tab.md
  - ../../../context/DESIGN_SYSTEM.md
---

# Spec. Status batch editing

Planning router for the Envelope / Materials "Spec. Status" lag Ed reported on
2026-08-26, and for the batch-set capability the lag makes unavoidable.

## Why this exists

Setting one material's Spec. Status blocks the whole table for the duration of
a production round trip (~200–350 ms), and a second change made inside that
window is discarded with no feedback. Setting twenty in a row — the actual
working pattern during a certification review — is therefore twenty forced
pauses, each one requiring the user to watch for the control to come back.

The round trip itself is not the defect. It is ~100 ms of Brooklyn↔Ohio wire
plus ~25 ms of server compute (measured, see `PRD.md` §2), and no reasonable
amount of backend work removes it. **The defect is that the UI waits for it.**

PHN already solved this problem once. `SliceWriteJournal` +
`DraftWriteCoordinator` give the DataTable-backed tables optimistic rendering,
a serialized write queue, batch coalescing, and conflict recovery. Envelope
commands never adopted it and use a bare `useMutation` with an in-flight lock
instead. This is one interaction wearing four different faces, and the
Envelope face is the worst of them.

## Read order

1. `PRD.md` — the measured profile, the current-state audit, and the target
   behaviour.
2. `PLAN.md` — phase sequence and what has landed.
3. `decisions.md` — the accepted answers to PRD §7 Q1-Q5, and every
   deliberate deviation from `PLAN.md`.
4. `STATUS.md` — state, next step, verification recipe.

## Shape of the work

| Layer | Change |
| --- | --- |
| Frontend — shared ✅ | Route the envelope + aperture command surfaces through `DraftWriteCoordinator`, mirroring `useJournaledSliceCommit` |
| Frontend — Envelope ✅ | Optimistic `specification_status`; `busy` no longer arms for a status write (no new pending state — `decisions.md` D-4) |
| Frontend — Apertures ✅ | Same treatment for the Glazings / Frames spec report |
| Frontend — ReportTable ✅ | Row selection + a bulk status action (new; `ReportTable` had none) |
| Frontend — invalidation ✅ | Skip broad thermal/condensation invalidation when no thermal field moved |
| Backend ✅ | An optional `commands: [...]` form of the envelope command request, so a batch is one document rewrite (`decisions.md` D-8 — broader than the multi-id command PRD §6 proposed, and it covers apertures too) |

## Precedent to copy, not reinvent

- Optimistic queue + coalescing: `frontend/src/features/project_document/sliceWriteJournal.ts`
- Serialized transport + flush/cancel: `frontend/src/features/project_document/draftWriteCoordinator.ts`
- Wiring a surface to both: `frontend/src/shared/ui/data-table/feature/useJournaledSliceCommit.ts`
- Per-row (not per-grid) pending state: `frontend/src/features/documentation/components/DocumentationSummaryView.tsx:75`
- Save/Discard interaction with a pending queue: `frontend/src/features/project_document/hooks/useDraftLifecycle.ts:67`

## Filed here rather than in `planning/refactor/`

`planning/.instructions.md` §3 sends cross-cutting convergence work to
`planning/refactor/`. Phases 01–03 genuinely are that shape. Phase 04 added a
capability that did not exist anywhere in the app (batch status set), and it is
the half Ed actually asked for, so the packet was filed as a feature. It shipped
with the rest, so the split never had to be made.

## Not in scope

- Shrinking the project document or the command response. Measured at ~25 ms
  of server time on a 186 KiB document; it is not where the latency lives.
- Replacing the versioned-document write spine. Whole-document parse →
  mutate → serialize → write is the architecture, and it is fast enough.
- Merging `ReportTable` into `DataTable`. They stay separate; only the write
  path and the batch affordance converge.
