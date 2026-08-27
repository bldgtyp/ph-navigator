---
DATE: 2026-08-26
TIME: 22:10 EDT
STATUS: Complete — all four phases merged to main 2026-08-27
AUTHOR: Claude with Ed May
SCOPE: Phase sequence for spec-status write responsiveness and batch editing.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
---

# PLAN — Spec. Status batch editing

Phases are independently shippable and ordered by value per unit of risk.
Phase 01 alone removes the reported symptom; everything after it is
improvement rather than repair.

## Phase 01 — Envelope status writes stop blocking ✅

**Fixes:** PRD S-1, S-2, S-3, S-8, and S-5.
**Frontend only. No API change, no document change.**

**Landed 2026-08-26** on `feat/spec-status-batch-editing`. It absorbed more
than planned, because the pieces turned out to be inseparable — see
`decisions.md`:

- Steps 1 + 2 of **Phase 02** came with it (D-1): the optimistic path *is*
  a `SliceWriteJournal` scheduled on `getDraftWriteCoordinator`, so there
  was never an interim hand-rolled `onMutate` to write and then delete.
  That closes S-8 too.
- **Phase 03 step 2** (the invalidation trim, S-5) came with it: Phase 01's
  whole point is a fast burst of clicks, and each click was firing a broad
  thermal + condensation invalidation. Fixing the click rate without gating
  that would have multiplied the waste.
- Two steps were done differently from the text below, with reasons in
  `decisions.md` D-3 (the in-flight gate stays, scoped to structural
  commands) and D-4 (no new per-row pending affordance).

1. Give `useEnvelopeCommandMutation` an optimistic path for the field-level
   commands (`update_project_material` first), writing into the cached
   envelope read model and rolling back on error.
2. Delete the `commandInFlightRef` gate at `EnvelopePage.tsx:271`. Writes are
   ordered by the queue in Phase 02; until then React Query's per-mutation
   ordering plus the ETag retry is the interim.
3. Replace `busy={commandMutation.isPending}` on `MaterialsPanel` with a
   per-material pending set, mirroring `isRecordWriting`
   (`DocumentationSummaryView.tsx:75`). Structural actions (row delete,
   Edit-material) keep the existing `busy` semantics.

**Verify:** the browser recipe in `STATUS.md`. Six consecutive changes with
zero disabled controls observed, all six persisted after reload.

## Phase 02 — Coalesce queued status writes ✅

**Fixes:** makes PRD §5(4) real. (Steps 1, 2 and 4 landed with Phase 01;
S-8 and §5(3) are already closed.)

**Landed 2026-08-26.** Step 3 needed a backend enabler (`decisions.md` D-8):
`POST /draft/envelope/commands` took one `command`, so `buildBatchPayload`
could not collapse writes across different rows. It now also accepts
`commands: [...]`, applied as a single `apply_document_write`, and the journal
sets `batchable` + `buildBatchPayload`. Three fast clicks now drain as two
round trips. Measured cost model in `decisions.md` D-9.

The aperture product commands post to this same endpoint, so Phase 03 inherits
the enabler.

1. Wrap the field-level envelope commands in a `SliceWriteJournal` scheduled
   through `getDraftWriteCoordinator(projectId, versionId)` — the same
   coordinator instance DataTable already uses, so ordering across surfaces is
   one queue, not two.
2. Model the wrapper on `useJournaledSliceCommit`, including its failure path
   (`clearMountedDataTableHistories`, `discardedWritesMessage`,
   `runWithConflictHandling`). Do not write a new error vocabulary.
3. Set `batchable` + `buildBatchPayload` for status writes so queued changes
   coalesce.
4. ~~Resolve PRD Q1~~ — answered in `decisions.md` D-1.

**Verify:** Save during a burst of status changes flushes them (assert via
`coordinator.whenIdle()` in a Playwright/e2e test, matching
`useSliceTableController.test.tsx:376`); `beforeunload` arms while writes are
outstanding.

## Phase 03 — Apertures parity ✅

**Fixes:** PRD S-4. (S-5 landed with Phase 01.)

**Landed 2026-08-26.** The aperture product commands post to the **same**
`/draft/envelope/commands` endpoint, so Phase 02's enabler covered them for
free. They read a different slice (`ApertureSpecReportResponse`) and the
response is a bare `DraftWriteResult`, so the journal's `transport` folds the
returned ETags onto the optimistic projection rather than replacing it.

Two callers made the shared seam visible, so the journal wiring moved to
`project_document/useCommandJournal.ts` and both surfaces are now thin
`CommandJournalConfig` bindings over it. The allowlist invariant both surfaces
depend on is pinned from both sides (`decisions.md` D-12).

1. Apply Phases 01–02 to the Glazings / Frames spec report
   (`AperturesTab.tsx:372`, `ApertureSpecReportPanel.tsx:688`).
2. Gate `broadThermalInvalidationCommands` /
   `broadCondensationInvalidationCommands` membership for
   `update_project_material` on whether a thermal-relevant field is present on
   the command (`envelope/hooks.ts:336`).
3. Optionally close S-6 (Documentation spec status optimism) if PRD Q5 is
   answered yes.

**Verify:** on Envelope / Assemblies, a status-only change fires no thermal or
condensation request; a conductivity change still fires both.

## Phase 04 — Batch set ✅

**Fixes:** PRD S-7. The capability Ed asked for.

**Landed 2026-08-26.** Ed chose the checkbox + toolbar shape over an
apply-to-filtered button and a floating selection bar. `ReportTable` gained one
optional `selection` prop and a frozen select lane; the state above it is the
shared `useReportSelection`; the action is `BulkStatusAction` in the filter
row's summary slot. `useCommandJournal.submitAll` makes the whole run one
request (`decisions.md` D-13), and the checkbox paint became a shared
`.phn-check` recipe (D-14).

Verified in the browser against 12 seeded materials: filter to Needed (7) →
select all → Set spec. status → Complete moved all seven, cleared the
selection, and survived a reload (Needed 7→0, Complete 1→8).

1. Row selection in `ReportTable` (PRD Q3).
2. A bulk "Set Spec. Status →" action (PRD Q4), composing with the existing
   `StatusFilterChips`.
3. ~~Optional backend multi-id `update_project_material`~~ — superseded by
   Phase 02's `commands: [...]` form (`decisions.md` D-8), which the batch
   gesture uses directly.

**Verify:** filter to Needed → select all → Complete, in one gesture, on
BT-2524-scale data; reload confirms persistence.

## Sequencing notes

- Phase 01 is small and self-contained; it is the right thing to ship first
  even if the rest is deferred.
- Phase 02 is where the design risk is. Budget the Q1 decision before code.
- Phase 04 is the only phase that touches `ReportTable`, which is shared with
  `UValueReportPanel`. Selection is opt-in and that panel does not pass it, so
  the non-selectable path is unchanged; covered by the `ApertureSpecReportPanel`
  tests, which render real non-selectable tables in `canEdit: false` mode. The
  `AGENT-BROWSER` fixture has no apertures, so there is no screenshot of it.
- Per `CLAUDE.md`, the default execution model applies: Claude writes the
  phase spec, codex/gpt-5.5 builds, Claude reviews.
