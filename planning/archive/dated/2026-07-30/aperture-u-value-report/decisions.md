---
DATE: 2026-07-29
UPDATED: 2026-07-29 — Ed resolved D-4, D-6, D-7, D-8, D-9; no open decisions remain
TIME: 14:17 EDT
STATUS: All decisions resolved — D-4/D-6/D-7/D-8/D-9 accepted by Ed 2026-07-29; D-1..D-3, D-5 recommended-accepted (unvetoed)
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Accepted / rejected / open decisions for the Aperture U-Value Detail
  Report. Open items block phase kickoff, not further planning.
RELATED: ./PRD.md, ./research.md
---

# Decisions — Aperture U-Value Detail Report

## Accepted (recommended; flip to plain "Accepted" once Ed confirms)

### D-1 — Navigation: fourth sub-tab, not a title toggle
**Decision**: Add a **U-Values** sub-tab (`/apertures/u-values`) to the
existing `AppSubTabs` row alongside Apertures / Glazings / Frames.
**Rejected**: turning the "Aperture Types" title into a builder/reporting
toggle (Ed's initial sketch); a separate top-level project tab.
**Why**: the sub-tab mechanism already exists, is route-addressable
(bookmarkable, linkable from Phius correspondence), and Glazings/Frames set
the precedent that reports are sibling sub-tabs. A title-toggle is a second
navigation idiom, non-linkable, and low-discoverability. A top-level tab
over-weights what is conceptually part of Apertures.

### D-2 — The export mirrors the code, not the legacy spreadsheet
**Decision**: XLSX formulas implement PHN's actual math, including the 45°
corner split (`_side_frame_q`). We do **not** replicate the legacy sheet's
convention of charging corner rectangles fully to top/bottom frames.
**Why**: the deliverable's purpose is transparency of *PHN's* calculation.
Two conventions in one document would guarantee irreconcilable cells. The
conventions differ only when adjacent frame U-values differ; the XLSX
provenance block names the convention so a reviewer comparing against an
old hand-built sheet understands any small delta.

### D-3 — XLSX mirrors PHN rounding exactly
**Decision**: input cells carry full-precision SI-converted (or SI) values;
formula cells apply `ROUND(u_element, 4)` before area-weighting, matching
`service.py`. Result: recalculation in Excel reproduces the app's stored
numbers exactly, not approximately.
**Why**: "the sheet says 0.1627, the app says 0.1628" is precisely the kind
of certifier question this feature exists to eliminate.

### D-5 — Edge orientation: canonical exterior view, stated in a legend
**Decision**: report left/right as stored (exterior view); one-line legend
"Edges as seen from outside". No view-direction toggle on the report.
**Why**: the document model is exterior-canonical; a toggle adds state that
can silently disagree with a printed export.

## Accepted by Ed — 2026-07-29

### D-4 — Export source: saved version (Accepted)
Exports read the **saved version** (PHPP-export precedent); frontend shows
the `confirmDraftExport` warning when unsaved draft changes exist.
On-screen report shows the same source as the builder (draft for editors).
**Rejected**: exporting whatever the page shows (draft for editors) — would
produce Phius deliverables from unsaved state.

### D-6 — Area-weighted SHGC: glazing-area weighting (Accepted)
SHGC (g-value) rollups are weighted by **glazing area**, with the basis
named in the column header and the XLSX provenance block.
**Rejected**: whole-window-area weighting (the legacy sheet's `BU` column
convention) — SHGC is a glazing property; window-area weighting is only
kept as a note for reviewers comparing against old hand-built sheets. The
two differ whenever a type mixes glazings or frame fractions vary between
elements.

### D-7 — Unfinished elements in the rollup: option (a) — mirror the chip (Accepted)
The report's U-w rollup **matches the chip exactly**: unfinished elements
participate as U = 0, and the report makes this loud — row-level
"unfinished" treatment, a warning badge on the aperture summary row, and
an explicit annotation ("includes n unfinished element(s) as U = 0") on
screen and in both exports.
**Rejected**: (b) exclude-and-annotate — report and chip would silently
disagree; (c) fix the service so both exclude-and-warn — changes displayed
U-w values on unfinished projects; may be revisited as a separate feature.

### D-8 — Export capability gate (Accepted)
Add `APERTURE_EXPORT_U_VALUE_REPORT` capability mirroring
`ENVELOPE_EXPORT_PHPP`; the page itself needs only
`require_project_view_access`.

### D-9 — Consolidate the duplicate IP conversion constants (Accepted)
Backend exports define the canonical constant (`0.1761101838…`); the
frontend duplicates (`format-u-value.ts` 0.1761 vs `lib/units/thermal.ts`
0.1761101838) are folded onto the precise constant as a small in-scope
cleanup (display rounding hides the change at 2dp).
