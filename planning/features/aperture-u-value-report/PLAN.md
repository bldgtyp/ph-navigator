---
DATE: 2026-07-29
UPDATED: 2026-07-29 — detailed phase files written under phases/; this file is now the summary, the phase files are the working plans
TIME: 14:17 EDT
STATUS: Complete — sequence agreed; detailed plans in phases/phase-01..06
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: High-level implementation sequence for the Aperture U-Value Detail
  Report. Detailed phase files get written under phases/ when a phase starts.
RELATED: ./PRD.md, ./decisions.md, ./research.md
---

# PLAN — Aperture U-Value Detail Report

Branching: single feature branch off `main` (`feature/aperture-u-value-report`).
Backend phases 1-3 are independently mergeable; frontend phases 4-5 depend
on 2-3. Each phase ends with the closeout gate (`simplify`, `docs-pass`,
`make format`, `make ci`).

## Phase 01 — Backend: emit the per-side breakdown (parity-locked refactor)

- Snapshot current outputs: a test that runs `calculate_aperture_u_values`
  over representative fixtures (multi-element grid, mixed frames, an
  unfinished element, a void, a non-positive-glazing case) and pins
  `u_value_w_m2k` / areas to current values.
- Refactor `service.py` so `_side_frame_q` / `_calculate_element` return a
  structured per-side breakdown (edge length, interior length, center-strip
  area, half-corner areas, A_frame,e, Q_frame,e, Q_spacer,e) instead of
  discarding it. New models in `models.py`
  (`ApertureElementSideBreakdown`, extended element model) — additive; the
  existing endpoint response stays byte-identical (breakdown lives on new
  DTOs used by the report path only).
- Parity test proves refactor changed nothing.
- Verification: `make check-backend`.

## Phase 02 — Backend: report endpoint

- `GET …/apertures/u-values/report?source=` returning the full report DTO:
  per-aperture (name, dims, rollups incl. new glazing-area-weighted SHGC
  per D-6),
  per-element (name, grid position, glazing name/U/SHGC, per-side
  breakdown, warnings incl. the sharpened unassigned-vs-incomplete
  distinction), provenance metadata (version label, source, convention
  notes).
- No caching (or a name-inclusive namespace — decide in-phase; default
  none). Route wiring, access per D-8.
- Sibling MCP tool if cheap (`get_aperture_u_value_report`).
- Tests: response shape, warnings, rollup equals existing endpoint's U-w.

## Phase 03 — Backend: CSV + formula-XLSX exporters

- `csv_download_response` / `xlsx_download_response` in
  `features/shared/responses.py`.
- Pure serializers in the feature slice: `report_csv.py` (BOM/CRLF/RFC-4180,
  full precision) and `report_xlsx.py` (openpyxl; formulas per PRD §5.3,
  `ROUND(…,4)`, SUMPRODUCT/SUMIF rollups, Summary sheet, provenance block,
  `UNFINISHED` literals).
- `GET …/report/export?format=csv|xlsx&units=SI|IP` (default IP), reading
  the saved version per D-4. Canonical IP constant defined backend-side.
- Tests: CSV golden file; XLSX structural assertions (openpyxl re-read:
  formula strings, input values, blank-not-zero for unfinished). Stretch:
  one LibreOffice-recalc round-trip test if a headless recalc is available
  locally; otherwise manual verification step in the phase checklist.

## Phase 04 — Frontend: U-Values sub-tab page

- `paths.ts` + `AperturesTab.tsx` route branch + `AppSubTabLink`.
- New `components/UValueReportPanel.tsx`: summary table + per-aperture
  `ReportTable` sections with `renderExpansion` per-edge breakdown, footer
  totals, warning treatment, empty state, exterior-view legend.
- Query hook keyed consistently (fold into `apertureQueryKeys`); extend the
  u-value fetch gate beyond `isBuilderRoute`; invalidate on
  `affects_u_value`.
- Unit formatting via the global toggle; D-9 constant consolidation.
- Verification: `make frontend-dev-check` + agent-browser screenshots
  (editor draft, viewer version, unfinished project).

## Phase 05 — Frontend: downloads

- Header `AppMenu` with the two download items (pattern:
  `ExportHbjsonAction` + `useEnvelopePhppExport` controller), draft-export
  confirm dialog per D-4, filename slugs, busy/error states.
- Verification: browser download smoke of both files; open CSV/XLSX checks
  from PRD §7.

## Phase 06 — Docs pass

- `context/ui/pages/apertures-tab.md` §2.6.4; `context/GLOSSARY.md` if any
  new terms; fold accepted decisions back per `planning/.instructions.md`
  rule 4; update this folder's STATUS.md and archive when complete.
