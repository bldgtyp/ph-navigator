# Phase 05 — Installs modal (key view + paint assignment)

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  Not started
AUTHOR:  Ed + Claude
SCOPE:   Frontend. The core interaction: per-aperture modal with read-only
         key-view SVG, pick-type-then-paint-edges, bulk apply, copy-to,
         inline type creation. No builder-canvas changes.
RELATED: ../decisions.md (D-6c/d), ../PRD.md §5.1 layer 3 (wireframe), phases 02–04
```

Read first: `context/DESIGN_SYSTEM.md` (blessed components; modal chrome is
`shared/ui/ModalDialog.tsx` + `DialogActions.tsx`), `context/ui/pages/apertures-tab.md`.
Known gotcha (memory): modal-Escape vs viewer/builder hotkeys — the builder
already handles Esc at `ApertureCanvasContainer.tsx:317-347`; the modal must
stop propagation so Esc closes the modal without clearing builder selection.

## 1. Entry point

One small button per aperture in the builder header region (next to the
existing per-aperture actions — find the aperture header actions cluster in
`AperturesHeader`/`ApertureCanvasContainer` and match its button style).
Label: `Installs` (icon + text, title "Window install psi-values"). No new
canvas events (D-6d).

## 2. Modal layout (PRD §5.1 wireframe)

`components/InstallsModal.tsx` (+ CSS module in `apertures.css` token
families):

- **Left: key view.** `ApertureSvgCanvas` rendered read-only at fit zoom
  (compute like the builder's fit action) with a new overlay layer:
  - Per perimeter element-side, a tint rect from
    `elementRegionsMm` (`aperture-geometry.ts:111-147`) filled by the
    assigned type's color; inherited-default edges get a
    neutral/low-emphasis tint.
  - Interior (mulled) sides: hatched pattern + not clickable; small
    `0` glyph or legend note (PRD: the rule should be *visible*).
  - Hit handling: reuse the `ApertureHitTarget` pattern (per-side DOM
    targets) scoped inside the modal — do NOT touch
    `ApertureCanvasOverlay`.
- **Right: legend.** List of `aperture_install_types` rows: color swatch,
  name, formatted Ψ value, PDF chip when `pdf_report_asset_ids` non-empty,
  live usage count across the project ("14 edges"). Selecting a row arms
  paint mode. `+ New type…` opens the phase-03 create-row flow inline
  (reuse the table's row-insert machinery or a small form writing through
  the same payload builders — do not fork validation).
- Colors: deterministic assignment from a small design-token palette (order
  of rows), not user-chosen. Default row is always the neutral swatch.
- **Footer actions:** `Apply <selected type> to all edges` (this aperture);
  `Copy assignments to…` — popover multi-select listing only apertures with
  an **identical grid signature** (phase-02 `CopyElementInstalls` contract;
  filter client-side with the mirrored signature helper); `Done`.

## 3. Interaction rules

- Click a perimeter edge with a type armed → `setElementInstall(type)`;
  click an edge already carrying that type → clear to None (inherit).
- No armed type → clicking an edge shows its current assignment (tooltip /
  transient popover), does not mutate.
- All writes go through the existing apertures command mutation (drafts,
  undo journal, conflict handling come for free) — batch paint clicks with
  the same coalescing the builder uses if available.
- Esc closes (stop propagation); background click does not close if a paint
  is armed (prevent accidental loss — match `SetElementKindDialog`
  conventions).

## 4. Tests & exit gate

- Vitest: overlay renders correct rects per fixture (mull hatching,
  tints), paint toggle logic, copy-to filter by grid signature, legend
  usage counts.
- e2e: arm type → paint two edges → reopen modal → assignments persisted
  (use `--settle` for draft debounce); apply-to-all; copy-to a matching
  aperture; FrameRow cells (phase 04) reflect the change.
- Agent-browser screenshots: modal open with mixed assignments; PHI-style
  flow (several calculated types).
- This is the "see how the UI feels" phase — after the exit gate, capture a
  short screenshot sequence for Ed's review and pause for feedback before
  phase 06 polish decisions.
- Closeout gate; STATUS.md ledger.
