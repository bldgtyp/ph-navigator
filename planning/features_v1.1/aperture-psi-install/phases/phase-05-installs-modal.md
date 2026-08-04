# Phase 05 — Installs modal (key view + paint assignment)

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  ✅ Done 2026-08-04 (⏸ awaiting Ed's UI review — see as-built notes)
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

## As-built notes (2026-08-04)

- **Entry point:** one `Installs` button (title "Window install psi-values")
  in the builder header actions for the active aperture — not per-aperture
  row buttons; the modal always targets the active aperture.
- **View-model:** `install-overlay.ts` composes on
  `resolveInstallPsiForAperture` (the phase-04 resolver stays the single
  owner of edge resolution); each overlay cell carries the full
  `ResolvedInstallPsi` plus the raw slot for the paint transition. The
  copy-to filter mirrors the backend `_grid_signature`
  (`apertureGridSignature`).
- **Legend:** reads `useInstallTypeSummaries()` from the phase-04
  `InstallTypesProvider` (no forked slice query in the modal). Inline
  create goes through `installs/useCreateInstallType.ts`, which reuses the
  phase-03 payload builders + replace mutation and invalidates the
  apertures slice so summaries refresh. Ψ entry is unit-aware
  (`parseLinearPsiToWmK` + `psiUnitLabel`) so IP-mode input converts to SI.
  PDF marker is the blessed `chip chip--sm chip--outline`.
- **Fit zoom:** fits by width to exactly 360 px — equal to the SVG
  `MIN_CANVAS_WIDTH_PX` floor, so the floor can never re-scale the canvas
  out from under the absolutely-positioned overlay; tall apertures scroll
  vertically. The builder's `position: absolute` rule on
  `.aperture-svg-canvas` is overridden to `static` inside the modal (it
  collapsed the key view to 0 height otherwise).
- **Footer:** `Apply selected to all edges`; `Copy assignments to…` popover
  (extracted control, `useOutsidePointerDown` + `aria-expanded`); secondary
  `Close` (ManufacturerFiltersModal precedent) instead of a primary `Done`.
  Legend rows are plain toggle buttons with `aria-pressed` (not
  listbox/option).
- **No armed type → inspect:** via `title`/`aria-label` tooltips only; no
  transient popover was needed.
- **Write batching:** dispatches serialize through a `busy` flag; no
  coalescing layer (each paint is one `setElementInstall` command).
- **Test deltas from plan:** e2e paints one edge + clears it + apply-to-all
  + reload persistence on the 1×1 fixture (FrameRow phase-04 cells
  asserted); copy-to and mull hatching are covered by vitest
  (`install-overlay.test.ts` — signature filter, mull cells) rather than
  e2e, since the seeded fixture has a single aperture. Screenshots:
  `working/agent-browser/installs-modal-phase05.png` (default state) and
  `installs-modal-phase05-painted.png` (armed + painted top edge).
- **Deferred follow-ups:** backend-emitted grid signature on the apertures
  slice (so the copy-to predicate has one owner); a shared swatch primitive
  if a third feature needs color chips.
- **⏸ Pause:** per plan, Ed reviews the modal UI from the screenshots /
  live app before phase-06 polish decisions; phase 06 proceeds on the
  docs-integration work meanwhile.
