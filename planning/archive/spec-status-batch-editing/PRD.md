---
DATE: 2026-08-26
TIME: 22:10 EDT
STATUS: Complete — every §7 question answered in `decisions.md`; S-1…S-5, S-7, S-8 closed (S-6 deferred, D-7)
AUTHOR: Claude with Ed May
SCOPE: Behaviour contract for responsive, batchable specification-status
  editing on the Envelope / Materials and Apertures spec-report tables.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./decisions.md
  - ./STATUS.md
  - ../../../frontend/src/features/project_document/sliceWriteJournal.ts
  - ../../../frontend/src/features/project_document/draftWriteCoordinator.ts
  - ../../../frontend/src/shared/ui/data-table/feature/useJournaledSliceCommit.ts
  - ../../../context/ui/pages/envelope-tab.md
---

# PRD — Spec. Status batch editing

## 1. Problem

On Envelope / Materials, changing a material's Spec. Status pauses the table.
During a certification review the working pattern is to run down the column
setting a dozen or more statuses in one pass, and today each one costs a
forced wait. Ed, 2026-08-26:

> there are many times where the user wants to set a batch of 'Status', but
> has to wait between each one.

## 2. Measured profile (2026-08-26)

Profiled against `AGENT-BROWSER` locally and against the production instance,
sized from BT-2524 (`2f2b0cbd-19b7-41cb-9e38-72593c34d699`), the project Ed
named as the example case.

### 2.1 Where the bytes are

BT-2524's saved document is **186 KiB**. `project_materials` is **7.9 KiB of
it — 4%**:

| table | bytes | rows |
| --- | --- | --- |
| `equipment` | 57,535 | — |
| `assemblies` | 36,097 | 8 |
| `apertures` | 22,432 | 28 |
| `rooms` | 19,795 | — |
| `project_frames` | 19,683 | 23 |
| **`project_materials`** | **7,871** | **11** |
| everything else | 11,764 | — |

Every status change parses, validates, serializes, hashes and rewrites all
186 KiB. That is inherent to the versioned-document model — and it is cheap.

### 2.2 Server compute

Stage timings for one `update_project_material`, measured in-process against a
159 KiB document (Apple silicon, local Postgres):

| stage | ms |
| --- | ---: |
| parse draft basis (whole doc, Pydantic) | 1.8 |
| `apply_command` (the actual edit) | 5.5 |
| serialize + size check (whole doc) | 1.9 |
| `document_etag` (serialize + sha256) | 1.8 |
| `upsert_draft` (rewrite whole JSONB row) | 9.0 |
| build + encode response (full envelope read model, 160 KiB) | 2.6 |
| **total** | **≈ 25** |

Local end-to-end POST: 25–136 ms, median ≈ 40 ms.

### 2.3 Network floor

`GET /api/v1/health` — static, no DB, no auth — measured from Brooklyn with
the connection already established (`appconnect` ≈ 70 ms):

| target | TTFB |
| --- | --- |
| `api.ph-nav.com` (via Cloudflare) | 155–200 ms |
| `ph-navigator-api.onrender.com` (origin direct) | 154–197 ms |

Both are the same, so this is the Ohio round trip, not Cloudflare. Response
compression is already on (`GZipMiddleware`, plus Cloudflare brotli), so
payload size is not the lever either.

**One status change in production ≈ 200–350 ms**: ~100 ms wire + 60–120 ms of
Render CPU. Only the second term is ours, and shrinking it changes nothing a
user can feel.

### 2.4 What the UI does with that time

Measured in a real browser against the local stack, sampling `disabled` state
at 60 fps: on a change to one row, **12 of 12** status controls go disabled for
the full round trip. The command also fires exactly one request — the drift,
documentation-summary and draft-summary invalidations do not refetch on this
route, so request fan-out is not a contributor.

## 3. Current state (audited 2026-08-26)

| # | Where | Today | Problem |
| --- | --- | --- | --- |
| S-1 | `MaterialsPanel.tsx:246` | `disabled={busy}` on every row's `StatusSelect`, where `busy = commandMutation.isPending` (`EnvelopePage.tsx:453`) | The whole grid is inert for the round trip. The user cannot even open the next row's dropdown. |
| S-2 | `EnvelopePage.tsx:271` | `if (commandInFlightRef.current \|\| commandMutation.isPending) return false;` | A second command inside the window is **discarded silently** — no queue, no error, no visual. A fast user loses edits. |
| S-3 | `useEnvelopeCommandMutation` (`envelope/hooks.ts:43`) | No `onMutate`. The pill does not move until the server answers. | Every change reads as latency even when it will succeed. |
| S-4 | `AperturesTab.tsx:372` → `ApertureSpecReportPanel.tsx:688` | `reportBusy` disables every Glazings / Frames status control the same way | Same lockout on a second surface. No in-flight drop here, so S-2 is Envelope-only. |
| S-5 | `envelope/hooks.ts:336` | `update_project_material` is in `broadThermalInvalidationCommands` and `broadCondensationInvalidationCommands` unconditionally | A status-only change invalidates thermal + condensation for **every** assembly. Invisible on Materials (those queries are inactive there); real waste on Assemblies. |
| S-6 | `documentation/hooks.ts:141` | `applyOptimisticDocumentationFieldChange` returns the summary unchanged for `spec_status` — datasheet and photo statuses are optimistic, spec status is not | The Documentation page has the same non-optimistic spec status, for no stated reason. |
| S-7 | `ReportTable.tsx` | No row selection, no bulk action | There is no batch affordance to reach for, on any `ReportTable` surface. |
| S-8 | envelope + aperture commands | Neither surface uses `DraftWriteCoordinator`, so an in-flight command is not counted by `writesPending` (`useDraftLifecycle.ts:195`) | Save does not flush it and the `beforeunload` guard does not cover it. A Save issued during a status write races it. **Correctness, not just speed.** |

## 4. One interaction, four faces

| Surface | Optimistic | Disable scope | Concurrent change |
| --- | --- | --- | --- |
| DataTable-backed tables (Rooms, Equipment, …) | yes — `SliceWriteJournal` | none | queued + coalesced |
| Documentation | datasheet / photo only (S-6) | per **row** (`isRecordWriting`) | queued by React Query |
| Apertures — Glazings / Frames | no | whole **grid** | allowed, unordered |
| **Envelope — Materials** | **no** | whole **grid** | **dropped (S-2)** |

The rightmost column is the one Ed reported. The leftmost row is the fix,
already written and tested in this repo.

## 5. Target behaviour

1. **The status pill moves on click.** Optimistic write into the cached
   envelope read model, rolled back on failure, following the
   `SliceWriteJournal` accept → render → transport → ack shape rather than a
   hand-rolled `onMutate`.
2. **Nothing else on the page goes inert.** Only the row with an unacked write
   shows a pending affordance, and even that stays interactive. Take the
   per-row rule from `DocumentationSummaryView.tsx:75`; take the visual from
   `context/DESIGN_SYSTEM.md` § Interaction states — do not invent a state.
3. **Writes queue; they are never dropped.** `DraftWriteCoordinator` already
   serializes per `(projectId, versionId)`, which is exactly what the ETag-gated
   write spine requires. Delete the `commandInFlightRef` gate rather than
   widening it.
4. **Consecutive status writes coalesce.** The coordinator's `batch.key` /
   `buildBatchPayload` path already collapses queued writes of the same kind.
   Twenty fast clicks should drain as a small number of round trips, not
   twenty.
5. **A batch is one gesture.** Select rows in `ReportTable`, then "Set Spec.
   Status →". With the existing `StatusFilterChips` this composes into the real
   workflow: filter to Needed, select all, mark Complete.
6. **A status-only command does not invalidate thermal or condensation.** Every
   field on `UpdateProjectMaterialCommand` is optional, so the client can tell
   a status change from a conductivity change. Gate S-5 on the presence of a
   thermal-relevant field.
7. **Save and Discard see pending status writes.** Free once (3) lands:
   `flushWrites` / `cancelWrites` in `useDraftLifecycle.ts:67` already drive
   the coordinator, and `writesPending` already arms the `beforeunload` guard.
8. **Failure is legible.** On rejection the affected rows revert and the error
   states how many writes were discarded — reuse `discardedWritesMessage` and
   `draftConflictMessage` rather than a new error string.

## 6. Backend

Nothing is required. Phase 04 optionally adds a multi-id form of
`update_project_material` so a 20-row batch is one command instead of 20
coalesced ones; the win is ~20× fewer document rewrites, not user-visible
latency, and it is worth doing only if (4) proves insufficient.

If it is added, it goes through `apply_document_write` like every other
command, and the MCP `apply_envelope_command` surface inherits it for free.

## 7. Open questions

**All five are answered in `decisions.md` (D-1, D-2, D-5, D-6, D-7). The
leanings below are kept as the reasoning that produced those answers.**

- **Q1.** Does the whole envelope command surface move to the journal, or only
  status-shaped commands? Structural commands (`create_assembly`,
  `import_envelope_constructions`) have side effects — navigation on create,
  dialogs on import — that an optimistic queue would have to model. **Leaning:
  journal the field-level commands, leave structural commands on the current
  awaited path.** This is the main design decision in the packet.
- **Q2.** Can the optimistic apply be derived rather than hand-written? The
  DataTable journal uses `mergeSlicePayload` on a row-shaped payload. Envelope
  commands are semantic, so each journaled kind needs a local apply function.
  Confirm the set stays small (status + evidence flags) or the duplication
  becomes its own problem.
- **Q3.** Selection model for `ReportTable` — does it borrow
  `useGridRowSelection` from `data-table/`, or get a smaller local one?
  `ReportTable` has no cell cursor, so the DataTable hook may not fit.
- **Q4.** Does the batch action live in `StatusFilterChips`' toolbar row, or in
  a selection bar that appears only when rows are selected? Design-system
  question; the second is more conventional and has no precedent in the app.
- **Q5.** Should S-6 (Documentation spec status) be folded in? It is the same
  command through a different hook. Cheap while the context is loaded, but it
  widens the diff.

## 8. Done means

- Setting a status on Envelope / Materials renders immediately and leaves every
  other control usable.
- Twenty consecutive changes can be made as fast as the user can click, with
  none dropped and all persisted.
- Selecting N rows and setting their status is one gesture.
- Apertures Glazings / Frames behaves identically.
- Save issued during pending status writes flushes them first.
- A status-only change fires no thermal or condensation refetch.
- `context/ui/pages/envelope-tab.md` §2.7.3 and `apertures-tab.md` describe the
  pending/selection states that actually render.
