---
DATE: 2026-07-29
TIME: 14:31 EDT
STATUS: Ready after Phases 3 + 4
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
