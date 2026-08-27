---
DATE: 2026-08-27
TIME: 09:00 EDT
STATUS: Complete — all four phases merged to main 2026-08-27; not deployed
AUTHOR: Claude with Ed May
SCOPE: Current state, next step, and verification recipe for spec-status
  write responsiveness and batch editing.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./decisions.md
---

# STATUS — Spec. Status batch editing

## Current state

`Complete` — **all four phases merged to main** 2026-08-27, squashed from
`feat/spec-status-batch-editing`. `make ci` was green at merge (backend 1913,
frontend 2545). **Not deployed** — deploys are the "Deploy Production" Actions
workflow and Ed's call, never an agent's.

The profile numbers in `PRD.md` §2 were measured on 2026-08-26, not
estimated:

- Document composition and sizes: read-only SQL against the production
  database (`dpg-d909olr7uimc7396sls0-a`).
- Server stage timings: in-process harness against a 159 KiB local document.
- Network floor: `curl` against `api.ph-nav.com` and the Render origin.
- Grid lockout: Playwright, sampling `disabled` at 60 fps.

### What Phase 01 closed

| PRD defect | Closed by |
| --- | --- |
| S-1 grid lockout | Status writes no longer touch `commandMutation`, so `busy` never arms for them |
| S-2 dropped concurrent write | Writes queue on `DraftWriteCoordinator`; the in-flight gate now only guards structural dialog actions (`decisions.md` D-3) |
| S-3 no optimism | `SliceWriteJournal` renders the pill on change and reverts on failure |
| S-5 broad thermal churn | `movesThermalInputs` gates the invalidation on a thermal-relevant field being present |
| S-8 Save races the write | Envelope writes — journaled *and* structural — are scheduled on the shared coordinator, so `flushWrites` and the `beforeunload` guard cover them |

### What Phase 02 closed

PRD §5(4), coalescing. `POST /draft/envelope/commands` now also accepts
`commands: [...]`, applied in order inside one `apply_document_write` — one
draft-basis parse, one ETag, one draft row rewrite, one audit entry, all or
nothing. The journal sets `batchable` + `buildBatchPayload`, so writes queued
behind an in-flight one drain as a single request. Three fast clicks are two
round trips.

The cost model is measured, not assumed, and the fold is linear — see
`decisions.md` D-9. The endpoint keeps the singular `command` form, so MCP and
every awaited editor action are untouched (D-10).

Also landed, unplanned but adjacent:

- `SliceWriteJournal` now takes a named options object instead of nine
  positional arguments (two of which call sites were passing as
  `undefined, null` filler). Both call sites and all six unit tests moved.
- The `prepareBase` "refetch only when the read query is invalidated" rule
  is one shared helper (`project_document/journalBase.ts`) instead of two
  copies.
- A rejected write on `/envelope/materials` used to revert its pill and say
  nothing — `commandError` was rendered only under the assembly canvas and
  inside dialogs. The Materials panel now renders it, matching the
  assemblies route.

### What Phase 03 closed

PRD S-4. Glazings / Frames evidence writes are optimistic, queued and
coalescing, exactly like Materials, and an evidence-only write no longer
invalidates the U-value, drift, or spec-report queries.

Two bindings made the seam obvious, so the journal wiring moved into
`project_document/useCommandJournal.ts`; Envelope and Apertures are now thin
config objects over it, and the field-allowlist invariant both rest on is
pinned by tests on both sides of the stack (`decisions.md` D-12). The
DataTable's `useJournaledSliceCommit` deliberately stays separate (D-11).

### What Phase 04 closed

PRD S-7, and the thing Ed actually asked for. Ed chose the checkbox + toolbar
shape from three options. `ReportTable` gained one optional `selection` prop and
a frozen select lane; `useReportSelection` owns the state above it, shared by
both surfaces; `BulkStatusAction` renders in the filter row's summary slot while
anything is selected, so the progress rollup keeps the slot the rest of the time.

`useCommandJournal.submitAll` sends the whole run as one request rather than
letting N writes race the queue (`decisions.md` D-13), and the checkbox mark
became one shared `.phn-check` recipe for both grids (D-14).

Fixed in passing: the report tables' empty-state message was being clipped to
the width of the expand gutter, because its single cell auto-placed into column
one instead of spanning the grid.

### What is still open
- **S-6** — Documentation spec-status optimism, deliberately deferred
  (`decisions.md` D-7). The only PRD defect not closed.
- **Deploy.** Merged but not released; the deploy event is separate from the
  merge in this repo.
- **Two browser checks the local fixture cannot reach** — see below.

## Next step

Phase 04, the batch-set gesture. Row selection in `ReportTable` (`decisions.md`
D-5) and a bulk "Set Spec. Status" action in the `StatusFilterChips` toolbar
row (D-6). With the journal already coalescing and the endpoint already taking
a command run, selecting N rows and setting their status is one gesture and one
request.

## Blockers

None. Every mechanism this needs is already built and tested in the repo:

- Optimistic queue — `sliceWriteJournal.ts`, with `sliceWriteJournal.test.ts`
- Serialized transport + batching — `draftWriteCoordinator.ts`, with
  `draftWriteCoordinator.test.ts`
- Reference wiring — `useJournaledSliceCommit.ts`
- Envelope wiring — `envelope/hooks/useEnvelopeCommandJournal.ts` (new)
- Save/Discard integration — `useDraftLifecycle.ts:67`

The one genuinely new thing left is row selection in `ReportTable` (Phase 04).

## Verification recipe

The reported symptom is a timing behaviour, so it needs a browser assertion,
not a unit test. Use the supported helper — see
`context/USING_A_WEB_BROWSER.md`; the MCP browser tools are unreliable here.

```bash
make agent-browser-ready     # :5173/:8000 + AGENT-BROWSER fixture (codex@example.com)
```

The fixture ships with no envelope materials, so seed some first — the
Materials table needs a dozen rows to exercise the interaction. Use
`phn-local` MCP `apply_envelope_command` (pass the current `draft_etag` as
`if_match`), or drive the local catalog picker in the UI.

Assertions, all against `/projects/<id>/envelope/materials`:

1. **No grid lockout.** Sample every
   `select.status-select[aria-label="Spec. Status"]` at animation-frame
   cadence across one change. Before: 12/12 disabled for the round trip.
   After: zero disabled at any sample.
2. **Nothing is dropped.** Fire six changes back-to-back with no waiting, then
   reload and confirm all six persisted. Use `--settle 1200` for the debounce
   (see `context/USING_A_WEB_BROWSER.md` recipes).
3. **Save flushes.** Issue a burst, then Save immediately; assert the saved
   version carries every change.
4. **No thermal churn.** On `/envelope/assemblies/<id>`, record network for a
   status-only change: no `…/thermal` or `…/condensation` request. A
   conductivity change still fires both.
5. **Batch set.** Filter to Needed → select all → Set spec. status → Complete,
   in one gesture, and reload to confirm it stuck.

### Evidence as of 2026-08-26

**Done in the browser** (assertion 5, against 12 materials seeded into the
`AGENT-BROWSER` draft with `phn-local` `replace_table`, then discarded and the
fixture reseeded):

- The select lane, the selected-row wash, and the frozen identity lane render
  correctly at 12 rows.
- Filter to Needed (7 of 12) → select all → Set spec. status → Complete moved
  all seven and cleared the selection; the toolbar handed the slot back to the
  progress rollup.
- A reload confirmed all seven persisted: Needed 7→0, Complete 1→8,
  "9 of 12 resolved".

**Covered by tests rather than the browser:**

- Assertions 1-3 — `features/envelope/__tests__/EnvelopePage.test.tsx`
  ("status writes render on click, stay interactive, and queue in order", the
  coalescing case, the failure-revert case, and the two batch cases).
- Assertion 4 — `features/envelope/__tests__/command-cache.test.ts`.
- The aperture surface — `features/apertures/__tests__/useApertureCommandJournal.test.tsx`
  drives the real hook against a mocked transport.

**Not done, and why:** the `AGENT-BROWSER` fixture has no apertures, so
Glazings / Frames and the U-Values report both render their own empty states.
Seeding apertures is a deeper setup than seeding materials (glazings and frames
only appear once aperture elements reference them). Two checks are therefore
still owed against a project with real apertures — ideally BT-2524 on a local
restore rather than the fixture:

1. Glazings / Frames evidence writes behave like Materials.
2. `UValueReportPanel` renders unchanged (it shares `ReportTable` but passes no
   `selection`, so the non-selectable path is what needs confirming).

Production latency is not reproducible locally — the local round trip is
~40 ms against ~250 ms in production — so judge Phase 01 by *what the UI
blocks on*, not by wall-clock.

## Notes carried in from the originating session (2026-08-26)

- BT-2524 (`2f2b0cbd-19b7-41cb-9e38-72593c34d699`) is the example case Ed
  named. 186 KiB document, 11 materials, 8 assemblies — so this is **not** a
  large-table rendering problem. React render cost was ~0 in the profile; the
  only main-thread long task observed (82 ms) was the initial page load.
- `/api/v1/health` — static, no DB, no auth — is 155–200 ms TTFB from Brooklyn
  with the connection warm, direct to the Render origin as well as through
  Cloudflare. That is the floor under *every* production interaction in this
  app, not just this one. Worth remembering before optimizing any backend
  handler for latency.
- Response compression is already on (`GZipMiddleware` at `main.py:78`, plus
  Cloudflare brotli). Shrinking the command response is not a lever.
- The command returns the **entire** envelope read model (~160 KiB on the
  profiling fixture) on every call. Left alone deliberately: it is ~2.6 ms to
  build and compresses well, and narrowing it would break the
  read-model-in-the-response contract the aperture surface shares.

## Log

- **2026-08-26 (phase 04)** — Batch set. Put the affordance to Ed rather than
  guessing: checkboxes + toolbar action, apply-to-filtered, or a floating
  selection bar; he picked the first. Reviews caught the selection layer being
  copy-pasted between the two panels and a preemptively-added indeterminate
  checkbox state with no way to reach it; both fixed. Verified the gesture in a
  real browser end to end, and fixed a pre-existing empty-state clipping bug
  found while looking at it.
- **2026-08-26 (phase 03)** — Apertures parity. Extracted
  `project_document/useCommandJournal.ts` once a second caller made the seam
  real, rather than guessing at it with one. Reviews pushed three shared rules
  out of the two bindings (`patchRowById`, `definedFieldPatch` /
  `patchesOnlyFields`, `discardedWriteFailureMessage`) and flagged that the
  allowlist invariant lived only in comments; it is now pinned by tests on both
  sides. Declined to fold `useJournaledSliceCommit` in (D-11).
- **2026-08-26 (phase 02)** — Coalescing. Added the `commands: [...]` request
  form (D-8) after confirming the single-command endpoint made
  `buildBatchPayload` impossible across rows. Reviews caught the docstring
  overclaiming its cost model; benchmarked the fold instead of asserting, and
  recorded the real numbers as D-9. Collapsed the request model to one
  canonical `commands` field with a `mode="before"` shim, and gave the audit
  row one shape for batch and single alike.
- **2026-08-26 (phase 01)** — Phase 01 built on
  `feat/spec-status-batch-editing`. Answered PRD Q1-Q5 in `decisions.md`
  (D-1…D-8), with two documented deviations from `PLAN.md` (D-3 the
  in-flight gate, D-4 no per-row pending state) and one extension (D-8, a
  command list rather than a multi-id command). Pulled S-5 and S-8 forward
  because Phase 01 amplified the first and could not honestly close without
  the second. Four cleanup reviews converged on the write-journal
  construction being copy-pasted plumbing; the response was to fix the
  shared primitive (named options object, one shared `prepareBase`) rather
  than merge two hooks with genuinely different payload shapes. Frontend
  gate green; no browser evidence yet.
- **2026-08-26 (planning)** — Ed reported the lag. Profiled end to end (production DB
  sizes, in-process stage timings, production network floor, browser lockout
  sampling). Root cause is the UI blocking on an unavoidable round trip, not
  server cost. Packet created; eight defects recorded as S-1…S-8, five open
  questions. No code written.
