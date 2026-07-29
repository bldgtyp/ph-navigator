---
DATE: 2026-07-29
UPDATED: 2026-07-29 — all decisions resolved by Ed; ready for Phase 01
TIME: 14:17 EDT
STATUS: Ready — planning complete, decisions resolved, Phase 01 next
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Router for the Aperture U-Value Detail Report feature — a fourth
  Apertures sub-tab showing the line-by-line ISO 10077-1 U-value calculation
  per aperture element, with CSV and formula-bearing XLSX downloads for Phius.
RELATED: ./PRD.md, ./STATUS.md, ./PLAN.md, ./decisions.md, ./research.md,
  context/ui/pages/apertures-tab.md, backend/features/aperture_u_value/
---

# Aperture U-Value Detail Report

Phius asks for a line-by-line breakdown of every window U-value calculation
(example: `_260701 Window Unit Detailed U-Values.xlsx` from Arverne East
Building D). PH-Navigator already computes element and area-weighted aperture
U-values (ISO 10077-1) but only shows the results. This feature adds a
**U-Values report sub-tab** under Apertures that exposes every intermediate
term of the calculation, plus two downloads: a raw-data **CSV** and an **XLSX
with live formulas** so Phius reviewers can audit the math cell by cell.

## The three things to know

1. **The math already exists; the intermediates don't.**
   `backend/features/aperture_u_value/service.py` computes everything but
   discards the per-side frame areas, spacer lengths, and heat-loss terms the
   report needs. Phase 1 is a pure service refactor to emit them, locked by
   parity tests — no behavior change to the existing endpoint.
2. **The export mirrors the code, not the legacy spreadsheet.** PHN uses a
   45° corner split between adjacent frames; Ed's hand-built sheet charges
   corners fully to top/bottom. The XLSX formulas will reproduce PHN's actual
   calculation (see `decisions.md` D-2). ψ-install is excluded from U-w
   (uninstalled value) and shown as an informational column only.
3. **UI is a fourth sub-tab, not a title toggle.** The Apertures tab already
   has route-addressable sub-tabs (Apertures | Glazings | Frames) via
   `AppSubTabs`; the report joins them at `/apertures/u-values` and reuses
   `ReportTable` with expandable per-edge rows (see `decisions.md` D-1).

## Read order

1. `STATUS.md` — current state and next step.
2. `PRD.md` — behavior contract: page layout, columns, exports, edge cases.
3. `decisions.md` — accepted/rejected/open decisions (open items need Ed).
4. `research.md` — code map, the Phius example decoded, precedents.
5. `PLAN.md` — phase sequence (phase files not yet written).

## Phase map (detailed plans in `phases/`)

| Phase | File | What | State |
| --- | --- | --- | --- |
| 01 | `phases/phase-01-breakdown-refactor.md` | Backend: per-side breakdown, parity-locked refactor | Ready |
| 02 | `phases/phase-02-report-endpoint.md` | Backend: report JSON endpoint (names, SHGC rollup, provenance, MCP) | After 01 |
| 03 | `phases/phase-03-exporters.md` | Backend: CSV + formula XLSX, `units` param, capability gate | After 02 |
| 04 | `phases/phase-04-report-page.md` | Frontend: U-Values sub-tab page (grouped ReportTable, expansions) | After 02 |
| 05 | `phases/phase-05-downloads.md` | Frontend: download actions + draft/unfinished guards | After 03+04 |
| 06 | `phases/phase-06-docs-pass.md` | Docs pass, glossary, graphify, archive | After 05 |
