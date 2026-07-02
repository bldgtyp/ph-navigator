---
DATE: 2026-07-01
TIME: -
STATUS: ✅ DONE (2026-07-01) — implemented on
  feature/model-viewer-construction-detail with as-built amendments (see
  §7 As-built notes).
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 3 — the read-only
  ConstructionDetailModal: header, to-scale SVG layer-stack drawing with
  segment sub-cells + steel-stud markers, and the expandable layer table.
RELATED:
  - ../PRD.md §4.2-§4.5 (modal content), §5 (D-4/D-6/D-7)
  - ../PLAN.md Phase 3
  - frontend/src/shared/ui/ModalDialog.tsx + styles/modals.css
  - frontend/src/features/model_viewer/lib/fieldConfigs.ts (formatters,
    tooltips to reuse)
  - frontend/src/features/envelope/components/AssemblySvgCanvas.tsx
    (SVG rect pattern reference — not imported)
---

# Phase 3 — Frontend: the ConstructionDetailModal

## 1. Goal

A self-contained, read-only `<ConstructionDetailModal construction onClose>`
that renders one `DetailedOpaqueConstruction`: a header (name/type/total
thickness/U/R), a to-scale SVG layer stack (segments + steel-stud
markers, colored by PH color), and an expandable layer table. Built and
tested against props in this phase; wired to the inspector button + store
in Phase 4.

## 2. Required reading (in order)

1. `../PRD.md` §4.2-§4.5 (exact modal content + empty/degenerate states),
   §5 (D-4 dedicated read-only renderer, D-6 color fallback, D-7 per-layer
   R is display-only).
2. `frontend/src/shared/ui/ModalDialog.tsx` — the shell to build on:
   props `title`, `titleId`, `onClose`, `children`, optional
   `headerAccessory` / `showHeaderClose`; Escape-to-close is built in
   (l.20-29). `styles/modals.css` for `modal-backdrop` / `modal-panel` /
   `modal-header` tokens.
3. `frontend/src/features/model_viewer/lib/fieldConfigs.ts` — reuse the
   construction formatters + tooltips verbatim for the header: `formatUValue`
   (l.402), `formatRValue` (l.406), the U/R tooltips (l.277-306), and
   `formatMetersAsLength` (l.364, exported — meters → length string).
   Conductivity → `formatConductivityFromWmK`; R per layer →
   `formatRValueFromM2KPerW` (`lib/units`). Read unit system via
   `useUnitPreference` (as `InspectorPanel`/`FieldRows` do, l.69-71).
4. `frontend/src/features/envelope/components/AssemblySvgCanvas.tsx` +
   `canvas-geometry.ts` — the SVG-rect drawing **pattern** (viewBox in mm,
   `<rect>` per segment, steel-stud/null-material handling). Reference
   only; reimplement against `ConstructionLayer[]` from Phase 2 (D-4).

## 3. Work breakdown

### 3.1 `components/ConstructionDetailModal.tsx`

Props: `{ construction: DetailedOpaqueConstruction; onClose: () => void }`.
Wrap `ModalDialog` (`title = construction.identifier`, a stable
`titleId`). Compute layers once via `buildConstructionLayers` (Phase 2).

**Header block** (§4.2): Type; Total Thickness (Σ layer thickness, via
`formatMetersAsLength`); U-Factor / U-Value / R-Factor / R-Value using the
existing formatters + tooltips. Respect the IP/SI toggle.

**Empty state** (§4.5): if `materials.length === 0`, render a plain "No
layer detail available for this construction." message instead of the
drawing/table (belt-and-suspenders — Phase 4's button already hides for
this case).

### 3.2 Layer-stack SVG (`components/ConstructionStackSvg.tsx`)

- ViewBox sized in real units: stack axis = Σ thickness; cross axis =
  normalized 1.0. Layers laid exterior→interior with "Exterior" /
  "Interior" end labels (orientation confirmed Phase 4 / PRD §13-Q1).
- One `<rect>` per cell: extent along the stack axis = layer thickness;
  across = `cell.widthFraction`. Fill = `cell.color` or the neutral
  fallback (D-6). Thin stroke between cells/layers for legibility.
- Steel-stud cells (`steelStudSpacingMm != null`): overlay a hatch/marker
  (reuse the `<pattern>` idea from `AssemblySvgCanvas`, l.54-64) and note
  the spacing (in the table; optionally a small glyph in the drawing).
- Purely presentational — no click/paint/pick handlers (this is not the
  Envelope canvas). `role="img"` + an `aria-label` naming the
  construction.

### 3.3 Layer table (`components/ConstructionLayerTable.tsx`)

- Columns: **#**, **Layer** (label), **Thickness**, **λ**
  (conductivity), **R**. One row per layer; a color swatch next to the
  label.
- Framed layers (`cells.length > 1`) are expandable to sub-rows: cell
  material label, λ, cell width (fraction → mm via the layer thickness
  context or shown as %/mm), and steel-stud spacing when present. Use a
  simple `useState` open-set keyed by layer index — no store.
- Totals row: total thickness; total R (Σ per-layer R). Note per D-7 this
  is a display reconciliation with the header R-Value, not a second
  source of truth — surface it as "Σ layers" so a small rounding delta
  reads as expected, not as a bug.

### 3.4 Styles

Add a scoped stylesheet (plain CSS on the 3-tier tokens per
`context/CODING_STANDARDS.md`; no Tailwind). Keep the modal comfortably
sized and scrollable for tall stacks.

## 4. Out of scope

The inspector button + open/close state + store lookup (Phase 4). Window
constructions (D-1). Any edit affordance, catalog lookup, or Envelope
import (D-8). Copy/export of the assembly (PRD §12 deferred).

## 5. Verification gate

1. **Vitest/RTL** against prop fixtures (the three kinds from Phase 2):
   - flat → N table rows, no expandable sub-rows, one full-width rect per
     layer;
   - hybrid → the framed layer expands to its cell sub-rows; the SVG has
     the expected cell-rect count;
   - steel-stud → the spacing renders in the expanded row + the marker is
     present;
   - null color → the fallback fill is applied (no crash);
   - totals row present; header U/R render through the shared formatters;
   - IP vs SI toggle flips thickness/λ/R units.
2. **A11y**: `role="dialog"` (from `ModalDialog`) + `role="img"` on the
   SVG with a label; Escape closes (built into `ModalDialog`).
3. `make format`.

## 6. Exit criteria

`ConstructionDetailModal` renders any flat or framed construction
correctly from props — drawing + table + totals + header, unit-aware,
empty-state-safe — verified by unit tests. Not yet reachable from the UI
(Phase 4 wires it).

## 7. As-built notes (2026-07-01)

Implemented as specified with UI-polish and simplify-review amendments:

- **Header figures as a stat-tile strip** (Thickness / U-Factor / U-Value
  / R-Factor / R-Value), tooltips shared with the inspector via
  `THERMAL_FIELD_TOOLTIPS` exported from `lib/fieldConfigs.ts` (the
  strings' original home; no duplication).
- **Drawing ↔ table hover linking**: hovering a table row outlines the
  layer in the SVG and vice versa (shared `hoveredIndex` owned by the
  modal). The drawing is sticky beside the scrolling table; layers carry
  `<title>` tooltips.
- **Framed layers start expanded** — the segment make-up is the reason
  the modal exists. Expansion state lives in the table (its only
  consumer), seeded from `isFramedLayer` (exported by the adapter lib —
  single definition of "framed").
- **Segmented layer swatches**: the table's per-layer swatch draws the
  cell stripes proportionally — a legend for the drawing. Null colors →
  hatch fallback in both HTML (CSS gradient) and SVG (`<pattern>`), D-6.
- **Steel-stud layers** get a diagonal overlay hatch in the drawing and a
  "Steel studs @ 406.4 mm o.c." note row in the table.
- Modal width via the established `id`-selector pattern
  (`#construction-detail.modal-panel`, mirroring `#climate-picker`) — the
  shared `ModalDialog` was left untouched.
- Adapter gained `widthM` on cells (authored column width in meters,
  null when degenerate) so sub-rows show real segment widths, plus shared
  `totalThicknessM` used by header stat, drawing scale, and totals row.
- 10 RTL cases: flat/framed/steel-stud rendering, expand/collapse,
  totals reconciliation, IP/SI flip, Escape-close, null-color fallback,
  empty state.
