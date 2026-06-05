---
DATE: 2026-06-05
TIME: 15:35 EDT
STATUS: Active — not yet started
AUTHOR: Codex
SCOPE: Replace the Phase 02 Builder placeholder with a real SVG
       canvas substrate: pure geometry helpers, the
       `ApertureSvgCanvas` component that renders each element as
       five SVG regions (top / right / bottom / left frame +
       glazing), null-frame dashed outline, view direction
       (exterior / interior), zoom (per-user preference). Keep all
       interaction (click, edit, overlay chrome) for later phases.
RELATED:
  - planning/features/apertures/PRD.md §6, §9, §9.1, §9.2, §9.3
  - planning/features/apertures/PLAN.md (Phase 03 row, R7)
  - planning/archive/assembly-builder/phases/phase-01-svg-canvas-substrate.md
    (canonical precedent — read first)
  - frontend/src/features/envelope/components/AssemblySvgCanvas.tsx
  - frontend/src/features/envelope/canvas-geometry.ts
  - research/ph-nav-v1-screenshots/aperture-builder/Window Builder.png
---

# Phase 3 — SVG canvas substrate

## P0. Why this slice

Phase 03 is the **rendering primitive**. It ships an SVG canvas with
a viewBox in mm and one `<rect>` per region — exterior-view, no
overlay chrome, no hit targets, no toolbar. The canvas is
proportional and never squashed: a 1000 mm × 2000 mm aperture
renders at exactly 1:2 regardless of viewport width.

Splitting the substrate from the overlay (Phase 04) matches the
Assembly Builder precedent — each PR stays reviewable (~500 LOC)
and the substrate gets visual-fidelity feedback before any
interaction is layered on.

By the end of Phase 03:

- `frontend/src/features/apertures/aperture-geometry.ts` exports
  pure helpers that translate `ApertureTypeEntry` into per-element,
  per-region geometry in mm. Helpers are unit-tested.
- `frontend/src/features/apertures/canvas-constants.ts` exports
  `BASE_PX_PER_MM`, `MIN_CANVAS_WIDTH_PX`, discrete `ZOOM_STEPS`,
  zoom bounds, and `pxFromMm(mm, zoom)`.
- `<ApertureSvgCanvas />` renders one `<svg>` per active aperture
  type, with five `<rect>` regions per element. Frame widths use
  `FrameRef.width_mm`; glazing fills the remainder.
- Null-frame or null-glazing renders as a blank fill plus
  `stroke-dasharray` (matches Assembly Builder's null-material
  visual language).
- View-direction state lives in user preferences
  (`aperture_builder_view_direction`), defaults `"exterior"`, with
  a Builder header toggle. Interior flips the column order of
  rendered regions (canonical data unchanged) — frame-label
  semantics in cards land in Phase 06.
- Zoom state lives in user preferences
  (`aperture_builder_canvas_zoom`), defaults `1.0`, with a
  `[−] 100% [+] [Fit]` cluster in the header.
- The main area replaces the Phase 02 placeholder with the canvas.

Phase 03 does **not** ship: hover affordances, click-to-pick,
on-canvas name pill, dimension strips, edge-hover add buttons,
operation symbols, element cards, U-Value chip values, manufacturer
filters, or any toolbar action beyond zoom + view direction.

## P1. Acceptance — Phase 3 done when

1. `aperture-geometry.ts` exports the following pure helpers (all
   in mm; no React imports):
   - `totalApertureWidthMm(entry): number`
   - `totalApertureHeightMm(entry): number`
   - `columnXOffsetMm(entry, columnIdx): number`
   - `rowYOffsetMm(entry, rowIdx): number`
   - `elementRectMm(entry, element):
      { x: number; y: number; width: number; height: number }`
   - `elementRegionsMm(element, rect):
      { top, right, bottom, left, glazing }`. Each region is
      `{ x, y, width, height }` in the same coordinate system.
      Frame widths are read from `element.frames.<side>.width_mm`
      (`0` if null / undefined). The glazing rect is the element
      rect minus the four frame widths.
   - `viewBoxFor(entry):
      { x: 0; y: 0; width: number; height: number }`.
   All six helpers are unit-tested with at least one single-element
   fixture, one 2×2 fixture, and one merged-element fixture.
2. `canvas-constants.ts` exports:
   ```ts
   export const BASE_PX_PER_MM = 0.18;
   export const MIN_CANVAS_WIDTH_PX = 360;
   export const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0] as const;
   export const ZOOM_MIN = ZOOM_STEPS[0];
   export const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1];
   export function pxFromMm(mm: number, zoom: number): number;
   ```
3. `<ApertureSvgCanvas />` renders:
   - one `<svg>` per active aperture, with
     `viewBox="0 0 widthMm heightMm"`,
     `preserveAspectRatio="xMinYMin meet"`, `shapeRendering="crispEdges"`.
   - `<svg width>` / `<svg height>` set to
     `widthMm * BASE_PX_PER_MM * zoom` and equivalent. No min-* on
     either axis; the outer wrapper provides horizontal scroll.
   - Per element: a `<g data-testid="element-{id}">` containing five
     `<rect>` regions in this order: `top`, `right`, `bottom`,
     `left`, `glazing`. The order matters so glazing renders on top
     when stroke fills overlap.
   - Each `<rect>` carries
     `data-testid="region-{element_id}-{side}"`.
   - Frame fill = `FrameRef.color` when valid hex; otherwise
     `var(--aperture-frame-default-fill)`.
   - Glazing fill = `GlazingRef.color` when valid hex; otherwise
     `var(--aperture-glazing-default-fill)`.
   - Null frame / null glazing: `fill="none"`,
     `stroke="var(--aperture-null-stroke)"`,
     `stroke-dasharray="4,3"`.
4. View direction:
   - Header toolbar exposes a single toggle button labelled
     `Viewing from Exterior` / `Viewing from Interior` (text +
     icon).
   - State lives in user preferences
     (`aperture_builder_view_direction: "exterior" | "interior"`).
     Defaults `"exterior"`.
   - Interior mode reverses the **rendered** column order: rendered
     element rects compute via
     `interiorColumnIdx = colsCount - 1 - canonicalColumnIdx` so
     the canonical document is untouched.
   - Card label flips and operation-symbol L↔R flips are not
     in this phase (Phase 06 / Phase 07).
5. Zoom:
   - Header toolbar exposes a zoom cluster:
     `[− zoom out] <percent> [+ zoom in] [Fit]`.
   - State lives in user preferences
     (`aperture_builder_canvas_zoom`). Default `1.0`.
   - `[−]` / `[+]` step through `ZOOM_STEPS` discretely.
     Disabled at bounds.
   - `Fit` recalculates a step that fits the canvas inside the
     visible main-area width (rounds to the nearest
     `ZOOM_STEPS` entry).
   - Zoom remains functional on locked versions and Viewer access.
6. Canvas overflow scrolls horizontally (CSS
   `overflow-x: auto`). Vertical content stays in view; if the
   canvas is taller than the main area, the page scrolls per the
   existing layout.
7. The Phase 02 `<ApertureBuilderPlaceholder />` is removed; the
   main area renders `<ApertureCanvasContainer />` (which mounts
   `<ApertureSvgCanvas />` plus the new toolbar). Empty-state
   behavior from Phase 02 is preserved.
8. `make ci` is green.

## P2. Files

### New

- `frontend/src/features/apertures/aperture-geometry.ts`
- `frontend/src/features/apertures/canvas-constants.ts`
- `frontend/src/features/apertures/components/ApertureSvgCanvas.tsx`
- `frontend/src/features/apertures/components/ApertureCanvasContainer.tsx`
- `frontend/src/features/apertures/components/ApertureCanvasToolbar.tsx`
- `frontend/src/features/apertures/components/ZoomCluster.tsx`
- `frontend/src/features/apertures/components/ViewDirectionToggle.tsx`
- `frontend/src/features/apertures/__tests__/aperture-geometry.test.ts`
- `frontend/src/features/apertures/__tests__/ApertureSvgCanvas.test.tsx`

### Modified

- `frontend/src/features/apertures/routes/AperturesPage.tsx`
  - Replace `<ApertureBuilderPlaceholder />` with
    `<ApertureCanvasContainer />`.
  - Keep empty-state fallback when `apertures.length === 0`.
- `frontend/src/features/apertures/apertures.css`
  - Add canvas / toolbar / null-region rules using CSS variables.
  - Add `--aperture-frame-default-fill`,
    `--aperture-glazing-default-fill`, `--aperture-null-stroke`,
    `--aperture-region-stroke` tokens.
- User-preferences store — add
  `aperture_builder_view_direction` and
  `aperture_builder_canvas_zoom` keys with default values.

### Deleted

- `frontend/src/features/apertures/components/ApertureBuilderPlaceholder.tsx`
  (Phase 02 placeholder).

## P3. Component shapes

```ts
// aperture-geometry.ts — sketch

export function totalApertureWidthMm(entry: ApertureTypeEntry): number {
  return entry.column_widths_mm.reduce((a, b) => a + b, 0);
}

export function totalApertureHeightMm(entry: ApertureTypeEntry): number {
  return entry.row_heights_mm.reduce((a, b) => a + b, 0);
}

export function columnXOffsetMm(entry: ApertureTypeEntry, idx: number): number {
  let x = 0;
  for (let i = 0; i < idx; i++) x += entry.column_widths_mm[i];
  return x;
}

export function rowYOffsetMm(entry: ApertureTypeEntry, idx: number): number {
  let y = 0;
  for (let i = 0; i < idx; i++) y += entry.row_heights_mm[i];
  return y;
}

export function elementRectMm(
  entry: ApertureTypeEntry,
  element: ApertureElement,
): { x: number; y: number; width: number; height: number } {
  const [c0, c1] = element.column_span;
  const [r0, r1] = element.row_span;
  const x = columnXOffsetMm(entry, c0);
  const y = rowYOffsetMm(entry, r0);
  let width = 0;
  for (let i = c0; i <= c1; i++) width += entry.column_widths_mm[i];
  let height = 0;
  for (let i = r0; i <= r1; i++) height += entry.row_heights_mm[i];
  return { x, y, width, height };
}

export function elementRegionsMm(
  element: ApertureElement,
  rect: { x: number; y: number; width: number; height: number },
) {
  const tw = element.frames.top?.width_mm ?? 0;
  const rw = element.frames.right?.width_mm ?? 0;
  const bw = element.frames.bottom?.width_mm ?? 0;
  const lw = element.frames.left?.width_mm ?? 0;
  const top = { x: rect.x, y: rect.y, width: rect.width, height: tw };
  const bottom = {
    x: rect.x,
    y: rect.y + rect.height - bw,
    width: rect.width,
    height: bw,
  };
  const left = {
    x: rect.x,
    y: rect.y + tw,
    width: lw,
    height: Math.max(0, rect.height - tw - bw),
  };
  const right = {
    x: rect.x + rect.width - rw,
    y: rect.y + tw,
    width: rw,
    height: Math.max(0, rect.height - tw - bw),
  };
  const glazing = {
    x: rect.x + lw,
    y: rect.y + tw,
    width: Math.max(0, rect.width - lw - rw),
    height: Math.max(0, rect.height - tw - bw),
  };
  return { top, right, bottom, left, glazing };
}

export function viewBoxFor(entry: ApertureTypeEntry) {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, totalApertureWidthMm(entry)),
    height: Math.max(1, totalApertureHeightMm(entry)),
  };
}

export function flipColumnForInterior(
  entry: ApertureTypeEntry,
  element: ApertureElement,
): ApertureElement {
  const cols = entry.column_widths_mm.length;
  const [c0, c1] = element.column_span;
  return {
    ...element,
    column_span: [cols - 1 - c1, cols - 1 - c0] as [number, number],
    frames: {
      ...element.frames,
      left: element.frames.right ?? null,
      right: element.frames.left ?? null,
    },
  };
}
```

```tsx
// ApertureSvgCanvas.tsx — sketch (parallel to AssemblySvgCanvas.tsx)

export function ApertureSvgCanvas(props: ApertureSvgCanvasProps) {
  const { aperture, zoom, viewDirection } = props;
  const vb = viewBoxFor(aperture);
  const pxW = Math.max(MIN_CANVAS_WIDTH_PX, pxFromMm(vb.width, zoom));
  const pxH = pxFromMm(vb.height, zoom);

  const renderedColumnWidths =
    viewDirection === "interior"
      ? [...aperture.column_widths_mm].reverse()
      : aperture.column_widths_mm;

  const renderedAperture: ApertureTypeEntry = {
    ...aperture,
    column_widths_mm: renderedColumnWidths,
    elements: aperture.elements.map((el) =>
      viewDirection === "interior" ? flipColumnForInterior(aperture, el) : el,
    ),
  };

  return (
    <svg
      className="aperture-svg-canvas"
      data-testid="aperture-svg-canvas"
      viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
      width={pxW}
      height={pxH}
      preserveAspectRatio="xMinYMin meet"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Aperture ${aperture.name}`}
    >
      {renderedAperture.elements.map((el) => {
        const rect = elementRectMm(renderedAperture, el);
        const regions = elementRegionsMm(el, rect);
        return (
          <g key={el.id} data-testid={`element-${el.id}`}>
            <RegionRect side="top" element={el} region={regions.top} />
            <RegionRect side="right" element={el} region={regions.right} />
            <RegionRect side="bottom" element={el} region={regions.bottom} />
            <RegionRect side="left" element={el} region={regions.left} />
            <GlazingRect element={el} region={regions.glazing} />
          </g>
        );
      })}
    </svg>
  );
}
```

## P4. Sequence

1. **Commit 1 — Geometry helpers.** Add `aperture-geometry.ts`
   with tests. Helpers exported but no caller.
2. **Commit 2 — Constants.** Add `canvas-constants.ts`. Used in
   commit 3.
3. **Commit 3 — `ApertureSvgCanvas` component.** Add the component
   + its test file. Exported, not yet mounted.
4. **Commit 4 — Toolbar (zoom + view direction).** Add
   `ApertureCanvasToolbar`, `ZoomCluster`, `ViewDirectionToggle`.
   Wire user-preference store keys.
5. **Commit 5 — `ApertureCanvasContainer` + mount.** Compose the
   toolbar over the canvas, mount in `AperturesPage`, delete the
   placeholder. Verify visual fidelity against
   `Window Builder.png`.
6. **Commit 6 — CSS tokens + null-region styling.** Tune fills,
   strokes, dashed pattern. `make ci` green.

## P5. Tests

### Unit — geometry helpers

- `totalApertureWidthMm` / `totalApertureHeightMm` sum array
  entries.
- `columnXOffsetMm(entry, 0) === 0`;
  `columnXOffsetMm(entry, n) === sum of first n widths`.
- `elementRectMm` on a 2×2 grid with a (0,0)→(0,1) merged element
  returns `{ x:0, y:0, width:colsum, height:rowHeights[0] }`.
- `elementRegionsMm`:
  - With non-zero frame widths, four frames + glazing tile the
    element rect with no gaps and no overlaps.
  - With one side's frame null (`width_mm=0`), that side region
    has `width=0` (or `height=0`) and glazing extends to the
    element edge.
  - With all four frames null, glazing equals the full element
    rect.
- `viewBoxFor` floors at 1 for both axes (prevents `0 0 0 0`).
- `flipColumnForInterior`:
  - For a single-column aperture, span unchanged.
  - For a 3-column aperture, span `(0, 1)` → `(1, 2)`; right
    frame ↔ left frame.

### Unit — `ApertureSvgCanvas`

- Renders one `<svg>` per aperture with the expected `viewBox`.
- Renders 5 `<rect>` per element (`top`, `right`, `bottom`,
  `left`, `glazing`).
- Null-frame `<rect>` has `fill="none"` and
  `stroke-dasharray="4,3"`.
- Interior view flips visible column order: a 3-column aperture
  with `columnWidths=[100, 200, 300]` renders rects in the
  order `[300, 200, 100]`.
- Canvas `role="img"` and `aria-label` name the active aperture.

### Invariant — proportional rendering

- Fixture with `column_widths_mm=[1000, 2000]` and
  `row_heights_mm=[1000]` renders SVG with `viewBox="0 0 3000 1000"`
  and pixel `width / height = 3.0` exactly. Test asserts ratio.

### Browser

- With Phase 02's add-aperture flow, create a 1×1 aperture and
  verify the SVG renders.
- Manually flip view direction; column order visibly reverses.
- Zoom in / out / Fit; canvas scales proportionally; horizontal
  scroll appears at large zoom.

## P6. Out of scope (lands in later phases)

- Hover / click / selection / on-canvas pill — Phase 04.
- Dimension strips, edge-hover `+`, total-dim caption — Phase 05.
- Element cards, picker buttons — Phase 06.
- Operation symbols — Phase 07.
- Merge / split + copy/paste — Phase 08.
- U-Value chip values — Phase 09.

## P7. Risks

- **R-03-1. Visual fidelity gap vs V1 screenshot during Phase
  03 → 04 transition.** The canvas exists but has no overlay
  chrome; the toolbar is bare. Mitigation: PR description names
  this as expected; Phase 04 closes the gap immediately after.
- **R-03-2. SVG snapshot tests flake.** Mitigation: assert
  structure (count of `<rect>`, viewBox value) rather than
  snapshot-stringify.
- **R-03-3. Interior view + per-side frame data coupling.**
  Section 9.3 of the PRD says canonical data is untouched; the
  frame-label flip in cards lands later. Mitigation:
  `flipColumnForInterior` returns a derived element, never
  mutates the source. Phase 06 reads the same helper for card
  labels.
