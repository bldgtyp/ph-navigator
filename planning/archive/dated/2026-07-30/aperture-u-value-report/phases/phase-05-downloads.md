---
DATE: 2026-07-29
UPDATED: 2026-07-30 — implementation and verification complete
TIME: 14:31 EDT
STATUS: Complete
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 5 — the two download actions on the U-Values page, with the
  saved-version/draft-skew guard. Frontend only.
RELATED: ../PRD.md §5.1, ../decisions.md §D-4,
  frontend/src/features/apertures/components/ExportHbjsonAction.tsx,
  frontend/src/features/envelope/hooks/useEnvelopePhppExport.ts,
  frontend/src/features/envelope/components/PhppExportWarningDialog.tsx,
  frontend/src/shared/lib/downloadBlob.ts
---

# Phase 5 — Download actions

## Goal

An `AppMenu` on the U-Values page header with **Download CSV (raw data)**
and **Download XLSX (with formulas)**, each fetching the Phase 3 export
endpoint and saving via `downloadBlob`, with the draft-skew warning
before exporting when unsaved changes exist.

## Hazards

1. **The export is saved-version; the page may be draft** (D-4). When the
   editor has unsaved changes, the dialog must say plainly that the file
   will *not* include them (`confirmDraftExport` copy precedent) — a
   silent mismatch between screen and file is the worst outcome here.
2. **No toast library exists** — errors go to the page's action-error
   banner, matching `ExportHbjsonAction`'s `onError` wiring.

## Work

1. **Controller hook** `useApertureUValueReportExport` modeled on
   `useEnvelopePhppExport`: takes `format` + current `units` preference,
   fetches the export endpoint, hands the blob to `downloadBlob` with the
   backend's filename (from `Content-Disposition`; fall back to the
   client-side slug helper). Injectable deps for tests
   (`download-file.ts` pattern). Busy state per item; single-flight.
2. **Dialog**: reuse/adapt the PHPP warning-dialog pattern for the two
   cases that need consent or notice before download:
   - unsaved draft exists → "Export uses the last saved version — your
     unsaved changes are not included" (proceed/cancel);
   - report has unfinished elements → notice that U-w includes them as
     zero and the file marks them `UNFINISHED` (proceed/cancel). Both
     conditions read from the already-fetched report DTO — no extra
     preflight endpoint.
3. **Menu**: `AppMenu label="U-value report actions"` in the page header
   (or the `AppSubTabs` `actions` slot if the header gets crowded — match
   whatever Phase 4 shipped): two `AppMenuItem`s, `Download` icon for
   CSV, `FileSpreadsheet` for XLSX (envelope-page icon precedent).
   Units passed from `useUnitPreference()` so the file matches what the
   user is looking at; both unit systems remain reachable by toggling.
4. **Capability**: menu hidden (not disabled) when the session lacks
   `APERTURE_EXPORT_U_VALUE_REPORT`, following how the envelope page
   gates its export items.
5. **Tests**: controller unit tests (blob path, filename fallback, error
   → callback, single-flight); dialog flow tests (draft-dirty and
   unfinished branches, cancel does nothing); menu visibility off the
   capability.

## Out of scope

Backend changes; docs (Phase 6).

## Verification

`make frontend-dev-check`; browser smoke via `agent-browser.mjs`:
download both files against the AGENT-BROWSER fixture, confirm the CSV
opens in a spreadsheet app without mangled units (BOM working) and the
XLSX opens with formulas live; exercise the draft-dirty dialog by editing
without saving first. `make ci` before hand-off.

## Implementation ledger

- Added capability-gated CSV and XLSX actions in the U-Values sub-tab action
  slot. Downloads use the current SI/IP preference, the backend filename when
  exposed, and the existing blob-save utility.
- Added a shared API download response helper for
  `Content-Disposition` parsing. The backend now exposes that header through
  CORS so production cross-origin clients can read the canonical filename.
- The editor action loads the saved-version report independently of the draft
  page. The action remains hidden until both the saved report and draft guard
  are ready, preventing a pending-query bypass.
- The confirmation dialog states that unsaved draft changes are excluded and
  separately reports saved-version unfinished elements. Both notices can
  appear together.
- The controller is single-flight, reports errors to the page alert, and
  aborts in-flight requests on unmount.
- Focused verification passed: backend exporter route `8 passed`; frontend
  TypeScript plus `4` files / `24` tests; `make frontend-dev-check` passed
  with the repository's existing Fast Refresh warnings only.
- Full `make ci` passed: backend `1741 passed, 7 skipped`; frontend `256`
  files / `2365` tests, structural guards, and production build.
- Live task-isolated browser verification exercised the dirty-draft consent
  flow and downloaded both formats in IP units. The CSV had UTF-8 BOM/CRLF
  output and IP headers; the XLSX was a valid workbook with `Window Units`
  and `Summary` sheets.
- The saved browser fixture version intentionally contained no apertures while
  its draft contained the representative aperture, so both downloads were
  empty by design and directly proved the saved-version guard. Formula-bearing
  XLSX recalculation remains covered by the Phase 03 desktop-Excel check.
- Attempting to save that fixture draft returned the unrelated fixture error
  `Asset does not exist for this project.` The export behavior itself has no
  blocker.
