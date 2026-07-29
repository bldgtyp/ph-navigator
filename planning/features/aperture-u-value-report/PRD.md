---
DATE: 2026-07-29
UPDATED: 2026-07-29 — all open decisions resolved by Ed (D-4 saved-version export, D-6 glazing-area SHGC, D-7 mirror-the-chip rollup, D-8 capability, D-9 constant consolidation)
TIME: 14:17 EDT
STATUS: Ready — behavior contract complete, all decisions resolved; Phase 01 next
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Product and behavior contract for the Aperture U-Value Detail Report —
  a read-only reporting sub-tab under Apertures plus CSV and formula-XLSX
  exports that let Phius audit the ISO 10077-1 calculation line by line.
RELATED: ./decisions.md, ./research.md, ./PLAN.md,
  context/ui/pages/apertures-tab.md, context/UI_UX.md,
  backend/features/aperture_u_value/service.py,
  frontend/src/features/apertures/routes/AperturesTab.tsx
---

# PRD — Aperture U-Value Detail Report

## 1. Problem

Phius certification reviewers ask for the *full* window U-value derivation,
not just the result: for every window element, the glazing and per-edge frame
inputs, the intermediate areas and lengths, each heat-loss term, and the
area-weighted rollup — delivered as a spreadsheet whose formulas they can
trace (reference artifact: `_260701 Window Unit Detailed U-Values.xlsx`,
"Window Units" sheet, Arverne East Building D; decoded in `research.md` §2).

PH-Navigator computes exactly this math (`aperture_u_value/service.py`,
ISO 10077-1:2006) but shows only the end results: a U-w chip per aperture
type and a per-element U on the builder canvas. The intermediates are
computed and discarded. Producing the Phius deliverable is today a manual
re-derivation in Excel — error-prone and disconnected from the model.

## 2. Goal

One place in the app where the entire calculation is visible and two
downloads that make it portable:

- **On screen**: a *U-Values* report sub-tab under Apertures showing every
  glazed element of every aperture type with its full breakdown.
- **CSV**: flat raw data (values only), one row per element — for scripts,
  pivot tables, and archival.
- **XLSX**: the same data with **live formulas** reproducing PHN's actual
  calculation, so a reviewer can click any result cell and see its
  derivation — the PHN-generated equivalent of the hand-built Phius sheet.

Non-goals: no editing on this page; no change to the U-value math; no
ψ-install incorporation into U-w (tracked separately in
`planning/features_v1.1/aperture-psi-install/`); no per-building-instance
reporting (the report is per aperture *type*, matching both the builder and
the Phius example, whose `A1_C0_R0` rows are element grid positions, not
building placements).

## 3. The calculation being reported (contract)

The report must present, per glazed element, exactly what
`service.py` computes — never a parallel derivation:

```
interior_width  = W − w_left − w_right
interior_height = H − w_top − w_bottom
A_glazing       = interior_width × interior_height
Q_glazing       = A_glazing × U_g

per edge e ∈ {top, right, bottom, left}:
  A_frame,e = w_e × interior_len_e  +  (w_e × w_adjA)/2  +  (w_e × w_adjB)/2
              (center strip)           (45° half-corner)     (45° half-corner)
  Q_frame,e  = A_frame,e × U_f,e
  Q_spacer,e = interior_len_e × Ψ_g,e

U_element = (Q_glazing + Σ Q_frame + Σ Q_spacer) / (W × H)
U_w (aperture) = Σ (round(U_element, 4) × A_element) / Σ A_element
```

where `interior_len` is `interior_width` for top/bottom edges and
`interior_height` for left/right edges. ψ-install is **not** part of U-w
(uninstalled value — matches the existing `UValueChip` tooltip).

Divergences from the legacy hand-built sheet are deliberate and documented
(decisions D-2, D-3): PHN splits corners 45° between adjacent frames (the
legacy sheet charges corners fully to top/bottom); totals differ only when
adjacent frame U-values differ.

## 4. UI / UX

### 4.1 Navigation — fourth sub-tab (decision D-1)

Add **U-Values** to the existing `AppSubTabs` row:
`Apertures | Glazings | Frames | U-Values`, route
`/projects/:projectId/apertures/u-values` (new path fn in
`features/apertures/paths.ts`, new branch in `AperturesTab.tsx`).

The "toggle the 'Aperture Types' title between builder and reporting"
idea was considered and rejected: the tab already owns a route-addressable
sub-tab mechanism, and Glazings/Frames set the precedent that reports are
sibling sub-tabs. A second navigation idiom (title-as-toggle) would be
inconsistent, non-linkable, and invisible to users who don't think to click
a title. A sub-tab is discoverable, bookmarkable, and free.

This does not conflict with `apertures-tab.md` §2.6.1's "don't force a
separate audit page" intent: the builder keeps its U-w chip and on-canvas
per-element U-values; the report adds depth and export, it doesn't relocate
the summary.

### 4.2 Page layout

Top-to-bottom:

1. **Summary table** (one row per aperture type — mirrors the example's
   Summary sheet): aperture name, overall W × H, element count, total area,
   area-weighted **U-w**, **glazing-area-weighted SHGC** (basis named in
   the column header, per D-6), warning badge if any element is unfinished.
2. **Per-aperture sections** (one per aperture type, in document order),
   each a `ReportTable` (`shared/ui/report-table/`) with one row per
   **glazed** element:
   - Main row (results altitude): element name, grid position (`C{c}_R{r}`),
     W × H, area, glazing name + U_g + SHGC, A_glazing, A_frame (total),
     Q_glazing, Q_frame (total), Q_spacer (total), **U_element**.
   - **Expandable row** (`renderExpansion`, same pattern as the spec report
     panel): the per-edge breakdown — for each of top/right/bottom/left:
     frame name, width, U_f, Ψ_g, Ψ-install (informational, flagged
     "excluded from U-w"), edge length, interior length, center-strip area,
     half-corner areas, A_frame,e, Q_frame,e, Q_spacer,e.
   - Section footer row: totals + the aperture U-w (must visibly equal the
     builder chip).
3. **Download actions**: `AppMenu` in the page header (pattern:
   `ExportHbjsonAction.tsx` / envelope PHPP export) with two items —
   *Download CSV (raw data)* and *Download XLSX (with formulas)*.

Orientation: edges are reported in the document's canonical **exterior**
view (left/right as stored). A one-line legend states this ("Edges as seen
from outside"). No view-direction toggle on the report (D-5).

Units on screen follow the global IP/SI topbar toggle, formatted
frontend-side from SI JSON exactly as the builder chip does today.

### 4.3 States

- **Read-only always** — for editors the page reflects their current
  draft; for viewers/locked versions, the saved version (same `source`
  derivation the builder uses).
- **Empty state**: no aperture types → standard empty-panel copy per
  `apertures-tab.md` conventions ("No apertures yet…" + link back to
  builder for editors).
- **Unfinished elements** (missing frame/glazing/psi data): row renders
  with an "unfinished" status treatment and em-dashes for uncomputable
  cells — **never `0.00`** (see §6.2). Aperture summary row shows a warning
  badge and its U-w — which matches the chip exactly, including unfinished
  elements as U = 0 (D-7 accepted: option a) — is annotated
  "includes n unfinished element(s) as U = 0".
- **Loading / error**: standard query loading + error banner patterns.

## 5. Exports

### 5.1 Common

- New backend endpoints (feature slice `aperture_u_value`, or a sibling
  `aperture_u_value_report` — Phase 1 decides):
  - `GET …/apertures/u-values/report` — detailed JSON for the page.
  - `GET …/apertures/u-values/report/export?format=csv|xlsx&units=SI|IP`
- Exports read the **saved version**; if the editor has unsaved draft
  changes, the frontend warns first (`confirmDraftExport` precedent)
  (D-4 accepted).
- `units` default **IP** for downloads (Phius audience; matches the example
  sheet), overridable to SI. All unit conversion happens **backend-side**
  with a single canonical constant (see §6.8).
- Filenames via the existing `suggestedFilename` slug pattern:
  `{bt-number}-aperture-u-values-{units}-{version}.{csv|xlsx}`.
- Access: `require_project_view_access` plus a new
  `APERTURE_EXPORT_U_VALUE_REPORT` capability, consistent with the envelope
  export gates (D-8 accepted).

### 5.2 CSV (raw data)

Flat, one row per glazed element, values only (no formulas). Columns:
project/aperture/element identifiers and names, grid position, W, H, area,
glazing (name, U_g, SHGC), then per edge × {frame name, width, U_f, Ψ_g,
Ψ-install, edge length, interior length, A_frame,e, Q_frame,e, Q_spacer,e},
then element totals (A_glazing, Q_glazing, Q_frame, Q_spacer, U_element)
and the aperture rollup (repeated per row, like the example's SUMPRODUCT
columns). Format: UTF-8 **with BOM**, CRLF, RFC-4180 quoting — matching the
DataTable CSV conventions (`shared/ui/data-table/lib/export/csv.ts`) so
Excel opens it cleanly.

### 5.3 XLSX (with formulas)

openpyxl (already a backend dependency, first *write* use in the repo).
Two sheets mirroring the Phius example's shape:

- **"Window Units"**: one row per glazed element. *Input* cells hold
  **full-precision** values (dimensions, U's, Ψ's — see §6.7); *calculated*
  cells hold real Excel formulas implementing §3 verbatim, including the 45°
  corner split and `ROUND(u_element, 4)` before area-weighting so the sheet
  reproduces PHN's stored results **exactly** (D-3). Area-weighted rollup
  columns per aperture use `SUMPRODUCT`/`SUMIF` keyed on the aperture name
  column (same technique as the example).
- **"Summary"**: one row per aperture type — name, area, area-weighted U-w
  and SHGC, referencing the detail sheet by formula.

Header rows carry the unit in the label (e.g. `U-VALUE (Btu/hr-ft²-°F)` /
`(W/m²K)`). A short provenance block (project, version label, generation
date, "Generated by PH-Navigator — ISO 10077-1:2006, uninstalled U-w,
45° corner split") sits above or beside the headers.

Unfinished elements: input cells left **blank** (not 0) and the row's
result cells replaced by the literal text `UNFINISHED` (no formula), so a
reviewer can never mistake a missing input for a real zero.

## 6. Edge cases & hazards (from code research — `research.md` §4)

1. **Void elements** (`kind: "void"`): excluded from the calc and from
   report rows/exports (consistent with existing spec-report behavior).
   Section header notes "n void panels excluded" when present so areas
   visibly reconcile against overall W × H.
2. **Missing assignments produce silent zeros today.** The service returns
   `u=0.0` for an element missing any frame or the glazing, and that zero
   *participates* in the area-weighted U-w. The report must not launder
   this: rows show "unfinished", exports show blanks/`UNFINISHED`, and the
   rollup — which mirrors the chip's include-as-zero behavior exactly
   (D-7 accepted: option a) — carries an explicit "includes n unfinished
   element(s) as U = 0" annotation on screen and in both exports.
   Changing the service to exclude-and-warn was considered and deferred
   (would change displayed U-w on unfinished projects).
3. **"Missing frame" really means "assigned but incomplete"** whenever
   `width_mm`, `u_value_w_m2k`, or `psi_g_w_mk` is null on an assigned
   frame. The report should distinguish *unassigned* from *incomplete
   product data* in the warning text (the current warning message is
   misleading; small backend copy fix in scope).
4. **Non-positive glazing area** (frames wider than the element): existing
   `non_positive_glazing_area` warning; report row shows the geometry
   inputs plus the warning rather than nonsense negative areas.
5. **Mullion-at-void-boundary** warnings surface on the relevant edge cell
   in the expansion.
6. **Shared mullions are double-counted by design**: adjacent elements each
   charge the full mullion width, so summed frame area can exceed physical
   frame area. The legacy Phius sheet uses the same convention, so parity
   holds — but the PRD records it as a known modeling convention and the
   XLSX provenance block states it.
7. **Rounding reconciliation**: backend rounds per-element U to 4dp before
   weighting; areas to 6dp. The XLSX must write full-precision inputs *and*
   mirror the code's rounding (`ROUND(...,4)`) so its results match the app
   to the displayed digit. CSV carries full-precision values.
8. **Two IP conversion constants exist in the frontend** (`0.1761` in
   `format-u-value.ts` vs `0.1761101838` in `lib/units/thermal.ts`).
   Backend exports define the single canonical constant; the frontend
   duplicates are consolidated onto it as a small in-scope cleanup
   (D-9 accepted).
9. **ψ-install**: present in the data model, never used in U-w. Reported as
   an informational column explicitly labeled "excluded from U-w" (the
   example sheet has the column too, mostly 0) — prevents Phius asking why
   it's absent while not implying it's included.
10. **Draft vs saved skew**: the on-screen report (draft for editors) can
    differ from a download (saved version). The draft-export warning plus a
    "source: draft/version" caption on the page make the skew visible.
11. **Cache**: the existing u-value cache hashes only thermally-relevant
    fields — names are excluded, so the report (which includes names) must
    not be served from that cache keyed as-is. Either bypass caching for
    the report endpoint (computation is cheap) or use a separate namespace
    that includes names. Phase 2 decides; default = no cache.

## 7. Acceptance criteria

- U-Values sub-tab reachable at `/apertures/u-values`, listed in the
  sub-tab row, working for editor (draft) and viewer (version) access.
- Every number on the page is backend-computed (no frontend math beyond
  unit formatting) — `frontend/.instructions.md` compliance.
- Section footer U-w equals the builder chip for the same aperture and
  source, always.
- CSV opens cleanly in Excel (BOM/CRLF) and round-trips all values at full
  precision.
- XLSX: recalculating in Excel (or LibreOffice) changes **no** result cell
  vs the values PHN computed; element U's match the app at 4dp; per-type
  rollups match the chips.
- Unfinished elements never render or export as numeric zero.
- `make ci` green; new backend tests lock formula parity (service refactor
  produces identical results to pre-refactor snapshots) and exporter
  structure; frontend tests cover route, empty state, and unfinished-row
  rendering.
- `context/ui/pages/apertures-tab.md` gains §2.6.4 documenting the sub-tab.
